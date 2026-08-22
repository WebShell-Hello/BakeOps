import uuid
from decimal import Decimal
from pathlib import Path

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from bakeops.common.models import BaseModel


def receipt_invoice_upload_to(instance: "InventoryReceipt", filename: str) -> str:
    extension = Path(filename).suffix.lower()
    return f"inventory/receipts/{instance.id}/{uuid.uuid4().hex}{extension}"


class InventoryItem(BaseModel):
    ingredient = models.OneToOneField(
        "products.Ingredient",
        on_delete=models.PROTECT,
        related_name="inventory_item",
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0"),
        validators=(MinValueValidator(Decimal("0")),),
    )
    inventory_value = models.DecimalField(
        max_digits=16,
        decimal_places=4,
        blank=True,
        null=True,
        validators=(MinValueValidator(Decimal("0")),),
        help_text="Current inventory book value in GBP. Null means the existing stock is not fully valued.",
    )
    safety_buffer_days = models.PositiveSmallIntegerField(default=2)

    class Meta:
        ordering = ("ingredient__name",)
        permissions = (("manage_inventory", "Can manage inventory and production demand"),)

    def __str__(self) -> str:
        return f"{self.ingredient.name}: {self.quantity}{self.ingredient.base_unit}"

    @property
    def average_cost_per_base_unit(self) -> Decimal | None:
        if self.quantity <= 0 or self.inventory_value is None:
            return None
        return self.inventory_value / self.quantity


class ProductionPlan(BaseModel):
    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planned"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"

    reference = models.CharField(max_length=80, unique=True)
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="production_plans",
    )
    planned_date = models.DateField(db_index=True)
    quantity = models.PositiveIntegerField()
    actual_quantity = models.PositiveIntegerField(blank=True, null=True)
    actual_unit_material_cost = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        blank=True,
        null=True,
        validators=(MinValueValidator(Decimal("0")),),
        help_text="Estimated material cost per finished product captured when actual production is recorded.",
    )
    actual_cost_captured_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("planned_date", "product__name_zh")
        indexes = (models.Index(fields=("status", "planned_date"), name="production_plan_window_idx"),)
        constraints = (
            models.UniqueConstraint(
                fields=("planned_date", "product"),
                name="unique_production_plan_product_date",
            ),
        )
        permissions = (("manage_production_plans", "Can manage production plans"),)

    def __str__(self) -> str:
        return f"{self.product.name_zh} · {self.planned_date} · {self.quantity}"


class PurchaseRequest(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        CONVERTED = "CONVERTED", "Converted to purchase order"
        CANCELLED = "CANCELLED", "Cancelled"

    reference = models.CharField(max_length=80, unique=True)
    ingredient = models.ForeignKey(
        "products.Ingredient",
        on_delete=models.PROTECT,
        related_name="purchase_requests",
    )
    supplier = models.ForeignKey(
        "suppliers.Supplier",
        on_delete=models.PROTECT,
        related_name="purchase_requests",
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=(MinValueValidator(Decimal("0.001")),),
    )
    unit = models.CharField(max_length=24)
    unit_price = models.DecimalField(max_digits=12, decimal_places=4)
    currency = models.CharField(max_length=3, default="GBP")
    price_unit = models.CharField(max_length=24)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        "users.User",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="inventory_purchase_requests_created",
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = (models.Index(fields=("status", "created_at"), name="purchase_request_state_idx"),)

    def __str__(self) -> str:
        return self.reference


class InventoryReceipt(BaseModel):
    reference = models.CharField(max_length=80, unique=True)
    ingredient = models.ForeignKey(
        "products.Ingredient",
        on_delete=models.PROTECT,
        related_name="inventory_receipts",
    )
    supplier = models.ForeignKey(
        "suppliers.Supplier",
        blank=True,
        null=True,
        on_delete=models.PROTECT,
        related_name="inventory_receipts",
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=(MinValueValidator(Decimal("0.001")),),
    )
    unit = models.CharField(max_length=24)
    base_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    base_unit = models.CharField(max_length=24)
    unit_price = models.DecimalField(max_digits=12, decimal_places=4, blank=True, null=True)
    currency = models.CharField(max_length=3, blank=True)
    price_unit = models.CharField(max_length=24, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    received_at = models.DateTimeField(default=timezone.now)
    invoice = models.FileField(upload_to=receipt_invoice_upload_to, blank=True)
    invoice_original_name = models.CharField(max_length=255, blank=True)
    invoice_content_type = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(
        "users.User",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="inventory_receipts_created",
    )
    recorded_by_employee = models.ForeignKey(
        "employees.Employee",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="inventory_receipts_recorded",
    )

    class Meta:
        ordering = ("-received_at", "-created_at")
        indexes = (models.Index(fields=("ingredient", "received_at"), name="inventory_receipt_item_idx"),)

    def __str__(self) -> str:
        return self.reference
