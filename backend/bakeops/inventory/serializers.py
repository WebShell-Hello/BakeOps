import uuid
from decimal import Decimal
from pathlib import Path
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
from bakeops.users.models import User


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


class InventoryReceiptBulkDeleteSerializer(serializers.Serializer[dict[str, Any]]):
    receipt_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )

    def validate_receipt_ids(self, value: list[Any]) -> list[Any]:
        return list(dict.fromkeys(value))


class InventoryReceiptWriteSerializer(serializers.Serializer[dict[str, Any]]):
    ALLOWED_INVOICE_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
    MAX_INVOICE_SIZE = 10 * 1024 * 1024

    ingredient_id = serializers.PrimaryKeyRelatedField(
        source="ingredient",
        queryset=Ingredient.objects.filter(is_active=True),
        required=False,
    )
    quantity = serializers.DecimalField(
        max_digits=14,
        decimal_places=3,
        min_value=Decimal("0.001"),
        required=False,
    )
    unit = serializers.CharField(max_length=24, required=False)
    supplier_id = serializers.PrimaryKeyRelatedField(
        source="supplier",
        queryset=Supplier.objects.all(),
        required=False,
    )
    unit_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal("0.0001"),
        required=False,
    )
    received_at = serializers.DateTimeField(required=False)
    notes = serializers.CharField(max_length=255, allow_blank=True, required=False)
    recorded_by_id = serializers.PrimaryKeyRelatedField(
        source="created_by",
        queryset=User.objects.filter(is_active=True),
        required=False,
    )
    invoice = serializers.FileField(required=False, allow_empty_file=False, write_only=True)
    remove_invoice = serializers.BooleanField(required=False, default=False, write_only=True)

    def validate_invoice(self, invoice: Any) -> Any:
        extension = Path(invoice.name).suffix.lower()
        if extension not in self.ALLOWED_INVOICE_EXTENSIONS:
            raise serializers.ValidationError("Invoice must be a PDF, JPG, PNG or WebP file.")
        if invoice.size > self.MAX_INVOICE_SIZE:
            raise serializers.ValidationError("Invoice file cannot exceed 10 MB.")
        return invoice

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        instance = self.instance
        required_fields = ("ingredient", "quantity", "unit", "supplier", "unit_price", "received_at")
        for field in required_fields:
            if field not in attrs and instance is None:
                api_field = f"{field}_id" if field in {"ingredient", "supplier"} else field
                raise serializers.ValidationError({api_field: "This field is required."})

        ingredient = attrs.get("ingredient", instance.ingredient if instance else None)
        quantity = attrs.get("quantity", instance.quantity if instance else None)
        unit = attrs.get("unit", instance.unit if instance else None)
        supplier = attrs.get("supplier", instance.supplier if instance else None)
        unit_price = attrs.get("unit_price", instance.unit_price if instance else None)
        if ingredient is None or quantity is None or unit is None or supplier is None or unit_price is None:
            raise serializers.ValidationError("Receipt data is incomplete.")
        if instance is not None and ingredient.id != instance.ingredient_id:
            raise serializers.ValidationError({"ingredient_id": "The ingredient cannot be changed after receipt."})
        if unit != display_unit_for(ingredient.base_unit):
            raise serializers.ValidationError({"unit": "The received unit must match the inventory display unit."})
        term = SupplierIngredient.objects.filter(
            ingredient=ingredient,
            supplier=supplier,
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
            purchase_value = calculate_purchase_value(quantity, unit, unit_price, term.price_unit)
        except ValueError as error:
            raise serializers.ValidationError({"unit_price": str(error)}) from error
        if attrs.get("remove_invoice") and attrs.get("invoice"):
            raise serializers.ValidationError(
                {"invoice": "Remove the existing invoice or upload a replacement, not both."}
            )

        attrs.update(
            ingredient=ingredient,
            quantity=quantity,
            unit=unit,
            supplier=supplier,
            unit_price=unit_price,
            received_at=attrs.get("received_at", instance.received_at if instance else timezone.now()),
            notes=attrs.get("notes", instance.notes if instance else ""),
            base_quantity=convert_quantity(quantity, unit, ingredient.base_unit),
            purchase_value=purchase_value,
            currency=term.currency,
            price_unit=term.price_unit,
        )
        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> InventoryReceipt:
        ingredient = validated_data.pop("ingredient")
        base_quantity = validated_data.pop("base_quantity")
        purchase_value = validated_data.pop("purchase_value")
        invoice = validated_data.pop("invoice", None)
        validated_data.pop("remove_invoice", None)
        request = self.context["request"]
        recorded_by = validated_data.pop("created_by", request.user)
        inventory, _ = InventoryItem.objects.select_for_update().get_or_create(ingredient=ingredient)
        apply_inventory_receipt(inventory, base_quantity, purchase_value)
        return InventoryReceipt.objects.create(
            reference=f"GRN-{uuid.uuid4().hex[:10].upper()}",
            ingredient=ingredient,
            base_quantity=base_quantity,
            base_unit=ingredient.base_unit,
            created_by=recorded_by,
            invoice=invoice or "",
            invoice_original_name=invoice.name if invoice else "",
            invoice_content_type=getattr(invoice, "content_type", "") if invoice else "",
            **validated_data,
        )

    @transaction.atomic
    def update(self, instance: InventoryReceipt, validated_data: dict[str, Any]) -> InventoryReceipt:
        receipt = InventoryReceipt.objects.select_for_update().get(pk=instance.pk)
        inventory = InventoryItem.objects.select_for_update().get(ingredient=receipt.ingredient)
        old_purchase_value = (
            calculate_purchase_value(
                receipt.quantity,
                receipt.unit,
                receipt.unit_price,
                receipt.price_unit,
            )
            if receipt.unit_price is not None and receipt.price_unit
            else Decimal("0")
        )
        new_base_quantity = validated_data.pop("base_quantity")
        new_purchase_value = validated_data.pop("purchase_value")
        new_quantity = inventory.quantity + new_base_quantity - receipt.base_quantity
        if new_quantity < 0:
            raise serializers.ValidationError(
                {"quantity": "This change would make current inventory negative."}
            )
        new_inventory_value = inventory.inventory_value
        if new_inventory_value is not None:
            new_inventory_value = new_inventory_value + new_purchase_value - old_purchase_value
            if new_inventory_value < 0:
                raise serializers.ValidationError(
                    {"unit_price": "This change would make current inventory value negative."}
                )
        inventory.quantity = new_quantity
        inventory.inventory_value = new_inventory_value
        inventory.full_clean()
        inventory.save(update_fields=("quantity", "inventory_value", "updated_at"))

        invoice = validated_data.pop("invoice", None)
        remove_invoice = validated_data.pop("remove_invoice", False)
        old_invoice_name = receipt.invoice.name if receipt.invoice else ""
        storage = receipt.invoice.storage
        if invoice is not None:
            receipt.invoice = invoice
            receipt.invoice_original_name = invoice.name
            receipt.invoice_content_type = getattr(invoice, "content_type", "")
        elif remove_invoice:
            receipt.invoice = ""
            receipt.invoice_original_name = ""
            receipt.invoice_content_type = ""

        validated_data.pop("ingredient", None)
        for field in (
            "supplier", "quantity", "unit", "unit_price", "received_at", "notes",
            "created_by", "currency", "price_unit",
        ):
            if field in validated_data:
                setattr(receipt, field, validated_data[field])
        receipt.base_quantity = new_base_quantity
        receipt.base_unit = receipt.ingredient.base_unit
        receipt.full_clean()
        receipt.save()
        if old_invoice_name and (invoice is not None or remove_invoice):
            transaction.on_commit(lambda: storage.delete(old_invoice_name))
        return receipt


class InventoryReceiptSerializer(serializers.ModelSerializer[InventoryReceipt]):
    ingredient_id = serializers.UUIDField(source="ingredient.id", read_only=True)
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    supplier_id = serializers.UUIDField(source="supplier.id", read_only=True, allow_null=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, allow_null=True)
    created_by_id = serializers.UUIDField(source="created_by.id", read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, allow_null=True)
    invoice_name = serializers.CharField(source="invoice_original_name", read_only=True)
    invoice_size = serializers.SerializerMethodField()
    invoice_download_url = serializers.SerializerMethodField()
    current_stock = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = InventoryReceipt
        fields = (
            "id", "reference", "ingredient_id", "ingredient_name", "supplier_id", "supplier_name",
            "quantity", "unit", "unit_price", "currency", "price_unit", "total_cost", "current_stock",
            "notes", "received_at", "created_by_id", "created_by_name", "invoice_name", "invoice_size",
            "invoice_download_url", "created_at",
        )

    def get_invoice_size(self, instance: InventoryReceipt) -> int | None:
        if not instance.invoice:
            return None
        try:
            return instance.invoice.size
        except OSError:
            return None

    def get_invoice_download_url(self, instance: InventoryReceipt) -> str | None:
        if not instance.invoice:
            return None
        return f"/api/v1/inventory/receipts/{instance.id}/invoice/"

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
