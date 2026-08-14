from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from bakeops.common.models import BaseModel


class Supplier(BaseModel):
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=160)
    address = models.TextField(blank=True)
    contact_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("name", "code")
        permissions = (("manage_suppliers", "Can manage suppliers and supply terms"),)
        constraints = (
            models.UniqueConstraint(Lower("name"), name="supplier_name_ci_unique"),
        )

    def __str__(self) -> str:
        return self.name


class SupplierIngredient(BaseModel):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="supplied_ingredients")
    ingredient = models.ForeignKey(
        "products.Ingredient",
        on_delete=models.PROTECT,
        related_name="supplier_terms",
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=(MinValueValidator(Decimal("0.0001")),),
    )
    currency = models.CharField(max_length=3, default="GBP")
    price_unit = models.CharField(max_length=24, default="kg")
    minimum_order_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=(MinValueValidator(Decimal("0.001")),),
    )
    minimum_order_unit = models.CharField(max_length=24, default="kg")
    lead_time_days = models.PositiveSmallIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    is_preferred = models.BooleanField(default=False)

    class Meta:
        ordering = ("-is_active", "ingredient__name", "supplier__name")
        constraints = (
            models.UniqueConstraint(
                fields=("supplier", "ingredient"),
                name="unique_supplier_ingredient",
            ),
            models.UniqueConstraint(
                fields=("ingredient",),
                condition=Q(is_active=True, is_preferred=True),
                name="unique_preferred_supplier_per_ingredient",
            ),
            models.CheckConstraint(
                condition=Q(is_preferred=False) | Q(is_active=True),
                name="preferred_supplier_ingredient_active",
            ),
        )
        indexes = (
            models.Index(
                fields=("supplier", "is_active"),
                name="supplier_term_active_idx",
            ),
            models.Index(
                fields=("ingredient", "is_active"),
                name="ingredient_term_active_idx",
            ),
        )

    def __str__(self) -> str:
        return f"{self.supplier.name} · {self.ingredient.name}"

