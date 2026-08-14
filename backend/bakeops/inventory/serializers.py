import uuid
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from bakeops.inventory.models import InventoryItem, InventoryReceipt, ProductionPlan, PurchaseRequest
from bakeops.inventory.services import (
    apply_inventory_receipt,
    calculate_purchase_value,
    convert_quantity,
    display_unit_for,
)
from bakeops.products.costing import current_product_unit_cost
from bakeops.products.models import Ingredient, Product
from bakeops.suppliers.models import Supplier, SupplierIngredient


class PurchaseRequestCreateSerializer(serializers.Serializer[dict[str, Any]]):
    ingredient_id = serializers.PrimaryKeyRelatedField(
        source="ingredient",
        queryset=Ingredient.objects.filter(is_active=True),
    )
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    unit = serializers.CharField(max_length=24)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        ingredient = attrs["ingredient"]
        if attrs["unit"] != display_unit_for(ingredient.base_unit):
            raise serializers.ValidationError({"unit": "The requested unit must match the inventory display unit."})
        term = (
            SupplierIngredient.objects.filter(ingredient=ingredient, is_active=True)
            .select_related("supplier")
            .order_by("-is_preferred", "unit_price", "supplier__name")
            .first()
        )
        if term is None:
            raise serializers.ValidationError(
                {"ingredient_id": "No active supplier is configured for this ingredient."}
            )
        attrs["supplier_term"] = term
        return attrs

    def create(self, validated_data: dict[str, Any]) -> PurchaseRequest:
        term = validated_data.pop("supplier_term")
        request = self.context["request"]
        return PurchaseRequest.objects.create(
            reference=f"PR-{uuid.uuid4().hex[:10].upper()}",
            supplier=term.supplier,
            unit_price=term.unit_price,
            currency=term.currency,
            price_unit=term.price_unit,
            created_by=request.user,
            **validated_data,
        )


class PurchaseRequestSerializer(serializers.ModelSerializer[PurchaseRequest]):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = PurchaseRequest
        fields = (
            "id",
            "reference",
            "ingredient_name",
            "supplier_name",
            "quantity",
            "unit",
            "unit_price",
            "currency",
            "price_unit",
            "status",
            "created_at",
        )


class InventoryReceiptCreateSerializer(serializers.Serializer[dict[str, Any]]):
    ingredient_id = serializers.PrimaryKeyRelatedField(
        source="ingredient",
        queryset=Ingredient.objects.filter(is_active=True),
    )
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    unit = serializers.CharField(max_length=24)
    supplier_id = serializers.PrimaryKeyRelatedField(
        source="supplier",
        queryset=Supplier.objects.all(),
    )
    unit_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal("0.0001"),
    )
    received_at = serializers.DateTimeField()
    notes = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        ingredient = attrs["ingredient"]
        if attrs["unit"] != display_unit_for(ingredient.base_unit):
            raise serializers.ValidationError({"unit": "The received unit must match the inventory display unit."})
        attrs["base_quantity"] = convert_quantity(attrs["quantity"], attrs["unit"], ingredient.base_unit)
        term = SupplierIngredient.objects.filter(
            ingredient=ingredient,
            supplier=attrs["supplier"],
            is_active=True,
        ).first()
        if term is None:
            raise serializers.ValidationError(
                {"supplier_id": "The selected supplier is not active for this ingredient."}
            )
        if term.currency != "GBP":
            raise serializers.ValidationError(
                {"supplier_id": "Inventory valuation currently supports GBP supplier terms only."}
            )
        try:
            attrs["purchase_value"] = calculate_purchase_value(
                attrs["quantity"],
                attrs["unit"],
                attrs["unit_price"],
                term.price_unit,
            )
        except ValueError as error:
            raise serializers.ValidationError({"unit_price": str(error)}) from error
        attrs["currency"] = term.currency
        attrs["price_unit"] = term.price_unit
        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> InventoryReceipt:
        ingredient = validated_data.pop("ingredient")
        base_quantity = validated_data.pop("base_quantity")
        purchase_value = validated_data.pop("purchase_value")
        inventory, _ = InventoryItem.objects.select_for_update().get_or_create(ingredient=ingredient)
        apply_inventory_receipt(inventory, base_quantity, purchase_value)
        request = self.context["request"]
        return InventoryReceipt.objects.create(
            reference=f"GRN-{uuid.uuid4().hex[:10].upper()}",
            ingredient=ingredient,
            base_quantity=base_quantity,
            base_unit=ingredient.base_unit,
            created_by=request.user,
            **validated_data,
        )


class InventoryReceiptSerializer(serializers.ModelSerializer[InventoryReceipt]):
    ingredient_id = serializers.UUIDField(source="ingredient.id", read_only=True)
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    supplier_id = serializers.UUIDField(source="supplier.id", read_only=True, allow_null=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, allow_null=True)
    current_stock = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = InventoryReceipt
        fields = (
            "id",
            "reference",
            "ingredient_id",
            "ingredient_name",
            "supplier_id",
            "supplier_name",
            "quantity",
            "unit",
            "unit_price",
            "currency",
            "price_unit",
            "total_cost",
            "current_stock",
            "notes",
            "received_at",
            "created_by_name",
            "created_at",
        )

    def get_current_stock(self, instance: InventoryReceipt) -> str:
        inventory = InventoryItem.objects.get(ingredient=instance.ingredient)
        current_stock = convert_quantity(inventory.quantity, instance.ingredient.base_unit, instance.unit)
        return format(current_stock, "f")

    def get_total_cost(self, instance: InventoryReceipt) -> str | None:
        if instance.unit_price is None or not instance.price_unit:
            return None
        try:
            priced_quantity = convert_quantity(instance.quantity, instance.unit, instance.price_unit)
        except ValueError:
            return None
        return format((priced_quantity * instance.unit_price).quantize(Decimal("0.01")), "f")


class ProductionPlanSerializer(serializers.ModelSerializer[ProductionPlan]):
    production_date = serializers.DateField(source="planned_date")
    planned_quantity = serializers.IntegerField(source="quantity")
    product_id = serializers.UUIDField(source="product.id", read_only=True)
    product_name_zh = serializers.CharField(source="product.name_zh", read_only=True)
    product_name_en = serializers.CharField(source="product.name_en", read_only=True)
    difference = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()

    class Meta:
        model = ProductionPlan
        fields = (
            "id",
            "reference",
            "production_date",
            "product_id",
            "product_name_zh",
            "product_name_en",
            "planned_quantity",
            "actual_quantity",
            "difference",
            "completion_rate",
            "display_status",
            "notes",
            "created_at",
            "updated_at",
        )

    def get_difference(self, instance: ProductionPlan) -> int | None:
        if instance.actual_quantity is None:
            return None
        return instance.actual_quantity - instance.quantity

    def get_completion_rate(self, instance: ProductionPlan) -> float | None:
        if instance.actual_quantity is None or instance.quantity == 0:
            return None
        return round(instance.actual_quantity / instance.quantity * 100, 1)

    def get_display_status(self, instance: ProductionPlan) -> str:
        if instance.status == ProductionPlan.Status.CANCELLED:
            return "CANCELLED"
        today = timezone.localdate()
        if instance.planned_date > today:
            return "PLANNED"
        if instance.planned_date < today:
            return "COMPLETED" if instance.actual_quantity is not None else "MISSING_ACTUAL"
        if instance.actual_quantity is not None and instance.actual_quantity >= instance.quantity:
            return "COMPLETED"
        return "IN_PROGRESS"


class ProductionPlanItemInputSerializer(serializers.Serializer[dict[str, Any]]):
    product_id = serializers.PrimaryKeyRelatedField(
        source="product",
        queryset=Product.objects.filter(sale_status=Product.SaleStatus.ON_SALE),
    )
    planned_quantity = serializers.IntegerField(min_value=1)
    actual_quantity = serializers.IntegerField(min_value=0, allow_null=True, required=False, default=None)


class ProductionPlanBatchSerializer(serializers.Serializer[dict[str, Any]]):
    production_date = serializers.DateField()
    items = ProductionPlanItemInputSerializer(many=True, allow_empty=False)
    notes = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")
    override_business_closure = serializers.BooleanField(required=False, default=False, write_only=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        products = [item["product"].id for item in attrs["items"]]
        if len(products) != len(set(products)):
            raise serializers.ValidationError({"items": "Each product can appear only once per production date."})
        if attrs["production_date"] > timezone.localdate() and any(
            item.get("actual_quantity") is not None for item in attrs["items"]
        ):
            raise serializers.ValidationError(
                {"items": "Actual quantity cannot be recorded for a future production date."}
            )
        from bakeops.events.models import BusinessClosure

        closure = BusinessClosure.objects.filter(
            start_date__lte=attrs["production_date"],
            end_date__gte=attrs["production_date"],
        ).first()
        if closure is not None and not attrs["override_business_closure"]:
            raise serializers.ValidationError(
                {
                    "production_date": (
                        f'The store is marked closed for "{closure.name}". '
                        "Confirm the closure override to create this production plan."
                    )
                }
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> list[ProductionPlan]:
        production_date = validated_data["production_date"]
        notes = validated_data["notes"]
        plans: list[ProductionPlan] = []
        for item in validated_data["items"]:
            product = item["product"]
            plan, _ = ProductionPlan.objects.update_or_create(
                planned_date=production_date,
                product=product,
                defaults={
                    "reference": f"PLAN-{production_date:%Y%m%d}-{str(product.id)[:8].upper()}",
                    "quantity": item["planned_quantity"],
                    "actual_quantity": item.get("actual_quantity"),
                    "status": ProductionPlan.Status.PLANNED,
                    "notes": notes,
                },
            )
            actual_quantity = item.get("actual_quantity")
            if actual_quantity is None:
                if plan.actual_unit_material_cost is not None:
                    plan.actual_unit_material_cost = None
                    plan.actual_cost_captured_at = None
                    plan.save(
                        update_fields=("actual_unit_material_cost", "actual_cost_captured_at", "updated_at")
                    )
            elif plan.actual_unit_material_cost is None:
                unit_cost = current_product_unit_cost(product)
                if unit_cost is not None:
                    plan.actual_unit_material_cost = unit_cost
                    plan.actual_cost_captured_at = timezone.now()
                    plan.save(
                        update_fields=("actual_unit_material_cost", "actual_cost_captured_at", "updated_at")
                    )
            plans.append(plan)
        return plans


class ProductionPlanUpdateSerializer(serializers.ModelSerializer[ProductionPlan]):
    planned_quantity = serializers.IntegerField(source="quantity", min_value=1, required=False)

    class Meta:
        model = ProductionPlan
        fields = ("planned_quantity", "actual_quantity", "notes")
        extra_kwargs = {
            "actual_quantity": {"min_value": 0, "allow_null": True, "required": False},
            "notes": {"allow_blank": True, "required": False},
        }

    def validate_actual_quantity(self, value: int | None) -> int | None:
        if value is not None and self.instance and self.instance.planned_date > timezone.localdate():
            raise serializers.ValidationError("Actual quantity cannot be recorded for a future production date.")
        return value

    def update(self, instance: ProductionPlan, validated_data: dict[str, Any]) -> ProductionPlan:
        actual_was_supplied = "actual_quantity" in validated_data
        instance = super().update(instance, validated_data)
        if not actual_was_supplied:
            return instance
        if instance.actual_quantity is None:
            instance.actual_unit_material_cost = None
            instance.actual_cost_captured_at = None
        elif instance.actual_unit_material_cost is None:
            unit_cost = current_product_unit_cost(instance.product)
            if unit_cost is None:
                return instance
            instance.actual_unit_material_cost = unit_cost
            instance.actual_cost_captured_at = timezone.now()
        instance.save(update_fields=("actual_unit_material_cost", "actual_cost_captured_at", "updated_at"))
        return instance
