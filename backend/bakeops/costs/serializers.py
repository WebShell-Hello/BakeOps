from decimal import Decimal

from rest_framework import serializers

from bakeops.costs.models import CostItem, MonthlyCost


class CostItemSerializer(serializers.ModelSerializer[CostItem]):
    class Meta:
        model = CostItem
        fields = ("id", "name_zh", "name_en", "category", "is_active", "notes", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")

    def validate_name_zh(self, value: str) -> str:
        return value.strip()

    def validate_name_en(self, value: str) -> str:
        return value.strip()

    def validate_notes(self, value: str) -> str:
        return value.strip()

    def validate_category(self, value: str) -> str:
        if value == CostItem.Category.MATERIALS and self.instance is None:
            raise serializers.ValidationError("Ingredients and materials is an automatic system cost item.")
        return value

class MonthlyCostSerializer(serializers.ModelSerializer[MonthlyCost]):
    cost_item_name_zh = serializers.CharField(source="name_zh", read_only=True)
    cost_item_name_en = serializers.CharField(source="name_en", read_only=True)
    source = serializers.SerializerMethodField()
    is_read_only = serializers.SerializerMethodField()
    calculation_complete = serializers.SerializerMethodField()
    missing_cost_count = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyCost
        fields = (
            "id",
            "cost_item",
            "cost_item_name_zh",
            "cost_item_name_en",
            "name_zh",
            "name_en",
            "category",
            "amount",
            "incurred_date",
            "cost_month",
            "source",
            "is_read_only",
            "calculation_complete",
            "missing_cost_count",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("cost_month", "created_at", "updated_at")

    def validate_notes(self, value: str) -> str:
        return value.strip()

    def validate_name_zh(self, value: str) -> str:
        return value.strip()

    def validate_name_en(self, value: str) -> str:
        return value.strip()

    def get_source(self, instance: MonthlyCost) -> str:
        return "PRODUCTION" if instance.category == CostItem.Category.MATERIALS else "MANUAL"

    def get_is_read_only(self, instance: MonthlyCost) -> bool:
        return instance.category == CostItem.Category.MATERIALS

    def get_calculation_complete(self, instance: MonthlyCost) -> bool:
        return bool(getattr(instance, "calculation_complete", True))

    def get_missing_cost_count(self, instance: MonthlyCost) -> int:
        return int(getattr(instance, "missing_cost_count", 0))

    def validate_cost_item(self, value: CostItem | None) -> CostItem | None:
        if value is not None and not value.is_active and (
            self.instance is None or self.instance.cost_item_id != value.id
        ):
            raise serializers.ValidationError("Disabled cost items cannot be used for new costs.")
        return value

    def validate(self, attrs):
        instance = self.instance
        incurred_date = attrs.get("incurred_date", instance.incurred_date if instance else None)
        cost_item = attrs.get("cost_item", instance.cost_item if instance else None)
        category = attrs.get(
            "category",
            cost_item.category if cost_item is not None else instance.category if instance else None,
        )
        if instance is None and category == CostItem.Category.MATERIALS:
            raise serializers.ValidationError(
                {"category": "Ingredients and materials is calculated automatically from production."}
            )
        if cost_item is not None and incurred_date is not None:
            queryset = MonthlyCost.objects.filter(
                cost_item=cost_item,
                cost_month=incurred_date.replace(day=1),
            )
            if instance is not None:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"cost_item": "This cost item already has a record for the selected month."}
                )
        target_month = incurred_date.replace(day=1) if incurred_date else None
        for field in ("name_zh", "name_en"):
            value = attrs.get(field, getattr(instance, field, "") if instance else "")
            if target_month and value:
                queryset = MonthlyCost.objects.filter(cost_month=target_month, **{field: value})
                if instance is not None:
                    queryset = queryset.exclude(pk=instance.pk)
                if queryset.exists():
                    raise serializers.ValidationError({field: "This name already exists in the selected month."})
        return attrs


class MonthlyCostAmountSerializer(serializers.Serializer):
    monthly_cost = serializers.PrimaryKeyRelatedField(queryset=MonthlyCost.objects.all())
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.00"))


class MonthlyCostBatchSerializer(serializers.Serializer):
    items = MonthlyCostAmountSerializer(many=True)

    def validate_items(self, value):
        ids = [item["monthly_cost"].id for item in value]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Each cost item may only appear once.")
        return value
