import uuid
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from bakeops.employees.models import Employee
from bakeops.events.activity_services import occurrence_display_status
from bakeops.events.models import (
    ActivityCategory,
    ActivityPlan,
    ActivityPlatform,
    ActivityReminderOccurrence,
    ActivityReminderRule,
    BusinessClosure,
    BusinessEvent,
    EventChecklistItem,
    Holiday,
)
from bakeops.events.services import event_status
from bakeops.products.models import Product

DEFAULT_CHECKLIST = (
    ("PRODUCT_PRODUCTION", "确认重点产品", "Confirm focus products"),
    ("PRODUCT_PRODUCTION", "调整生产计划", "Review production plan"),
    ("PRODUCT_PRODUCTION", "确认限定产品", "Confirm limited products"),
    ("INVENTORY_PURCHASING", "检查重点食材库存", "Check focus ingredient stock"),
    ("INVENTORY_PURCHASING", "确认供应商", "Confirm suppliers"),
    ("INVENTORY_PURCHASING", "创建采购订单", "Create purchase orders"),
    ("INVENTORY_PURCHASING", "确认包装材料", "Confirm packaging materials"),
    ("STORE_OPERATIONS", "调整员工排班", "Review staff schedule"),
    ("STORE_OPERATIONS", "确认营业时间", "Confirm opening hours"),
    ("STORE_OPERATIONS", "检查设备", "Check equipment"),
    ("STORE_OPERATIONS", "确认活动区域", "Confirm event area"),
    ("MARKETING", "确认宣传方案", "Confirm promotion plan"),
    ("MARKETING", "发布社交媒体内容", "Publish social media content"),
    ("MARKETING", "准备海报", "Prepare posters"),
    ("MARKETING", "确认合作方", "Confirm partners"),
)


class HolidaySerializer(serializers.ModelSerializer[Holiday]):
    class Meta:
        model = Holiday
        fields = ("id", "code", "name_zh", "name_en", "holiday_date", "region", "notes")


class EventChecklistItemSerializer(serializers.ModelSerializer[EventChecklistItem]):
    class Meta:
        model = EventChecklistItem
        fields = ("id", "category", "title_zh", "title_en", "is_completed", "position")
        extra_kwargs = {
            "title_zh": {"required": False, "allow_blank": True},
            "title_en": {"required": False, "allow_blank": True},
            "position": {"required": False},
        }

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        title_zh = attrs.get("title_zh", getattr(self.instance, "title_zh", ""))
        title_en = attrs.get("title_en", getattr(self.instance, "title_en", ""))
        if not title_zh and not title_en:
            raise serializers.ValidationError("A checklist title is required.")
        attrs["title_zh"] = title_zh or title_en
        attrs["title_en"] = title_en or title_zh
        return attrs


class BusinessEventSerializer(serializers.ModelSerializer[BusinessEvent]):
    focus_product_ids = serializers.PrimaryKeyRelatedField(
        source="focus_products",
        queryset=Product.objects.all(),
        many=True,
        required=False,
    )
    linked_holiday_id = serializers.PrimaryKeyRelatedField(
        source="linked_holiday",
        queryset=Holiday.objects.all(),
        allow_null=True,
        required=False,
    )
    focus_products = serializers.SerializerMethodField()
    checklist_items = EventChecklistItemSerializer(many=True, read_only=True)
    status = serializers.SerializerMethodField()
    preparation_start_date = serializers.SerializerMethodField()
    days_until_start = serializers.SerializerMethodField()
    duration_days = serializers.SerializerMethodField()
    checklist_completed = serializers.SerializerMethodField()
    checklist_total = serializers.SerializerMethodField()

    class Meta:
        model = BusinessEvent
        fields = (
            "id",
            "name",
            "event_type",
            "start_date",
            "end_date",
            "duration_days",
            "preparation_days",
            "preparation_start_date",
            "expected_impact",
            "expected_sales_change",
            "focus_product_ids",
            "focus_products",
            "estimated_cost",
            "currency",
            "notes",
            "linked_holiday_id",
            "status",
            "days_until_start",
            "checklist_completed",
            "checklist_total",
            "checklist_items",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})
        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> BusinessEvent:
        products = validated_data.pop("focus_products", [])
        request = self.context.get("request")
        event = BusinessEvent.objects.create(
            created_by=request.user if request and request.user.is_authenticated else None,
            **validated_data,
        )
        event.focus_products.set(products)
        positions: dict[str, int] = {}
        items = []
        for category, title_zh, title_en in DEFAULT_CHECKLIST:
            position = positions.get(category, 0)
            items.append(
                EventChecklistItem(
                    event=event,
                    category=category,
                    title_zh=title_zh,
                    title_en=title_en,
                    position=position,
                )
            )
            positions[category] = position + 1
        EventChecklistItem.objects.bulk_create(items)
        return event

    @transaction.atomic
    def update(self, instance: BusinessEvent, validated_data: dict[str, Any]) -> BusinessEvent:
        products = validated_data.pop("focus_products", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.full_clean()
        instance.save()
        if products is not None:
            instance.focus_products.set(products)
        return instance

    def get_focus_products(self, instance: BusinessEvent) -> list[dict[str, str]]:
        return [
            {"id": str(product.id), "name_zh": product.name_zh, "name_en": product.name_en}
            for product in instance.focus_products.all()
        ]

    def get_status(self, instance: BusinessEvent) -> str:
        return event_status(instance)

    def get_preparation_start_date(self, instance: BusinessEvent) -> str:
        return (instance.start_date - timedelta(days=instance.preparation_days)).isoformat()

    def get_days_until_start(self, instance: BusinessEvent) -> int:
        return (instance.start_date - timezone.localdate()).days

    def get_duration_days(self, instance: BusinessEvent) -> int:
        return (instance.end_date - instance.start_date).days + 1

    def get_checklist_completed(self, instance: BusinessEvent) -> int:
        return sum(item.is_completed for item in instance.checklist_items.all())

    def get_checklist_total(self, instance: BusinessEvent) -> int:
        return len(instance.checklist_items.all())


class BusinessClosureSerializer(serializers.ModelSerializer[BusinessClosure]):
    duration_days = serializers.SerializerMethodField()

    class Meta:
        model = BusinessClosure
        fields = ("id", "name", "closure_type", "start_date", "end_date", "duration_days", "notes")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})
        return attrs

    def create(self, validated_data: dict[str, Any]) -> BusinessClosure:
        request = self.context.get("request")
        return BusinessClosure.objects.create(
            created_by=request.user if request and request.user.is_authenticated else None,
            **validated_data,
        )

    def get_duration_days(self, instance: BusinessClosure) -> int:
        return (instance.end_date - instance.start_date).days + 1


class ActivityCategorySerializer(serializers.ModelSerializer[ActivityCategory]):
    class Meta:
        model = ActivityCategory
        fields = ("id", "code", "name_zh", "name_en", "colour", "icon_key", "position")


class ActivityPlatformSerializer(serializers.ModelSerializer[ActivityPlatform]):
    category_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = ActivityPlatform
        fields = ("id", "category_id", "code", "name_zh", "name_en", "position")


class ActivityCategoryCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if ActivityCategory.objects.filter(Q(name_zh__iexact=value) | Q(name_en__iexact=value)).exists():
            raise serializers.ValidationError("An activity category with this name already exists.")
        return value

    def create(self, validated_data: dict[str, Any]) -> ActivityCategory:
        name = validated_data["name"]
        return ActivityCategory.objects.create(
            code=f"CUSTOM_CATEGORY_{uuid.uuid4().hex.upper()}",
            name_zh=name,
            name_en=name,
        )

    def to_representation(self, instance: ActivityCategory) -> dict[str, Any]:
        return ActivityCategorySerializer(instance).data


class ActivityPlatformCreateSerializer(serializers.Serializer):
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=ActivityCategory.objects.filter(is_active=True),
    )
    name = serializers.CharField(max_length=100)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        category = attrs["category"]
        name = attrs["name"].strip()
        if ActivityPlatform.objects.filter(category=category).filter(
            Q(name_zh__iexact=name) | Q(name_en__iexact=name)
        ).exists():
            raise serializers.ValidationError({"name": "An activity platform with this name already exists."})
        attrs["name"] = name
        return attrs

    def create(self, validated_data: dict[str, Any]) -> ActivityPlatform:
        name = validated_data["name"]
        return ActivityPlatform.objects.create(
            category=validated_data["category"],
            code=f"CUSTOM_PLATFORM_{uuid.uuid4().hex.upper()}",
            name_zh=name,
            name_en=name,
        )

    def to_representation(self, instance: ActivityPlatform) -> dict[str, Any]:
        return ActivityPlatformSerializer(instance).data


class ActivityReminderRuleSerializer(serializers.ModelSerializer[ActivityReminderRule]):
    class Meta:
        model = ActivityReminderRule
        fields = (
            "id",
            "frequency",
            "interval",
            "weekdays",
            "month_days",
            "reminder_time",
            "timezone",
            "is_enabled",
        )
        read_only_fields = ("id",)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        frequency = attrs.get("frequency", getattr(self.instance, "frequency", None))
        weekdays = attrs.get("weekdays", getattr(self.instance, "weekdays", []))
        month_days = attrs.get("month_days", getattr(self.instance, "month_days", []))
        if not isinstance(weekdays, list) or any(not isinstance(day, int) or day < 1 or day > 7 for day in weekdays):
            raise serializers.ValidationError({"weekdays": "Weekdays must contain unique numbers from 1 to 7."})
        if len(set(weekdays)) != len(weekdays):
            raise serializers.ValidationError({"weekdays": "Weekdays cannot contain duplicates."})
        if not isinstance(month_days, list) or any(
            not isinstance(day, int) or day < 1 or day > 31 for day in month_days
        ):
            raise serializers.ValidationError({"month_days": "Month days must contain unique numbers from 1 to 31."})
        if len(set(month_days)) != len(month_days):
            raise serializers.ValidationError({"month_days": "Month days cannot contain duplicates."})
        if frequency == ActivityReminderRule.Frequency.WEEKLY and not weekdays:
            raise serializers.ValidationError({"weekdays": "Select at least one weekday."})
        if frequency == ActivityReminderRule.Frequency.MONTHLY and not month_days:
            raise serializers.ValidationError({"month_days": "Select at least one month day."})
        attrs["weekdays"] = sorted(weekdays)
        attrs["month_days"] = sorted(month_days)
        return attrs


class ActivityPlanSerializer(serializers.ModelSerializer[ActivityPlan]):
    category_id = serializers.PrimaryKeyRelatedField(source="category", queryset=ActivityCategory.objects.all())
    platform_id = serializers.PrimaryKeyRelatedField(source="platform", queryset=ActivityPlatform.objects.all())
    owner_id = serializers.PrimaryKeyRelatedField(
        source="responsible_employee",
        queryset=Employee.objects.filter(status=Employee.Status.ACTIVE, deleted_at__isnull=True),
        allow_null=True,
        required=False,
    )
    focus_product_ids = serializers.PrimaryKeyRelatedField(
        source="focus_products",
        queryset=Product.objects.all(),
        many=True,
        required=False,
    )
    category = ActivityCategorySerializer(read_only=True)
    platform = ActivityPlatformSerializer(read_only=True)
    owner_name = serializers.SerializerMethodField()
    reminder_rule = ActivityReminderRuleSerializer()
    next_reminder_at = serializers.SerializerMethodField()

    class Meta:
        model = ActivityPlan
        fields = (
            "id",
            "name",
            "category_id",
            "category",
            "platform_id",
            "platform",
            "description",
            "priority",
            "status",
            "start_date",
            "end_date",
            "owner_id",
            "owner_name",
            "focus_product_ids",
            "reminder_rule",
            "next_reminder_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        platform = attrs.get("platform", getattr(self.instance, "platform", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})
        if category and platform and platform.category_id != category.id:
            raise serializers.ValidationError({"platform_id": "The platform must belong to the selected category."})
        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> ActivityPlan:
        rule_data = validated_data.pop("reminder_rule")
        products = validated_data.pop("focus_products", [])
        request = self.context.get("request")
        plan = ActivityPlan.objects.create(
            created_by=request.user if request and request.user.is_authenticated else None,
            **validated_data,
        )
        plan.focus_products.set(products)
        ActivityReminderRule.objects.create(plan=plan, **rule_data)
        return plan

    @transaction.atomic
    def update(self, instance: ActivityPlan, validated_data: dict[str, Any]) -> ActivityPlan:
        rule_data = validated_data.pop("reminder_rule", None)
        products = validated_data.pop("focus_products", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.full_clean()
        instance.save()
        if products is not None:
            instance.focus_products.set(products)
        if rule_data is not None:
            rule_serializer = ActivityReminderRuleSerializer(instance.reminder_rule, data=rule_data)
            rule_serializer.is_valid(raise_exception=True)
            rule_serializer.save()
            instance.occurrences.filter(status=ActivityReminderOccurrence.Status.PENDING).delete()
        return instance

    def get_owner_name(self, instance: ActivityPlan) -> str:
        return instance.responsible_employee.name if instance.responsible_employee else ""

    def get_next_reminder_at(self, instance: ActivityPlan) -> str | None:
        occurrence = instance.occurrences.filter(
            status=ActivityReminderOccurrence.Status.PENDING,
            scheduled_at__gte=timezone.now(),
        ).order_by("scheduled_at").first()
        return occurrence.scheduled_at.isoformat() if occurrence else None


class ActivityReminderOccurrenceSerializer(serializers.ModelSerializer[ActivityReminderOccurrence]):
    display_status = serializers.SerializerMethodField()
    effective_at = serializers.SerializerMethodField()
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    platform = ActivityPlatformSerializer(source="plan.platform", read_only=True)
    category = ActivityCategorySerializer(source="plan.category", read_only=True)
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityReminderOccurrence
        fields = (
            "id",
            "plan_id",
            "plan_name",
            "platform",
            "category",
            "owner_name",
            "scheduled_at",
            "effective_at",
            "status",
            "display_status",
            "completed_at",
            "execution_notes",
            "result_url",
            "snoozed_until",
        )

    def get_display_status(self, instance: ActivityReminderOccurrence) -> str:
        return occurrence_display_status(instance)

    def get_effective_at(self, instance: ActivityReminderOccurrence) -> str:
        return (instance.snoozed_until or instance.scheduled_at).isoformat()

    def get_owner_name(self, instance: ActivityReminderOccurrence) -> str:
        employee = instance.plan.responsible_employee
        return employee.name if employee else ""
