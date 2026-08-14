from datetime import timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from bakeops.events.models import BusinessClosure, BusinessEvent, EventChecklistItem, Holiday
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
