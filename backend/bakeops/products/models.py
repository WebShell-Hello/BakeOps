from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q, Sum

from bakeops.common.models import BaseModel


class Ingredient(BaseModel):
    name = models.CharField(max_length=120, unique=True)
    base_unit = models.CharField(max_length=16, default="g")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Product(BaseModel):
    class SaleStatus(models.TextChoices):
        ON_SALE = "ON_SALE", "On sale"
        OFF_SALE = "OFF_SALE", "Off sale"

    code = models.CharField(max_length=64, unique=True)
    name_zh = models.CharField(max_length=120, unique=True)
    name_en = models.CharField(max_length=120, unique=True)
    sale_status = models.CharField(max_length=16, choices=SaleStatus.choices, default=SaleStatus.ON_SALE)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("name_zh", "name_en")
        permissions = (("manage_products", "Can manage products and recipes"),)

    def __str__(self) -> str:
        return self.name_zh


class Recipe(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="recipes")
    version = models.PositiveIntegerField(default=1)
    yield_quantity = models.PositiveIntegerField(default=1)
    yield_unit = models.CharField(max_length=24, default="个")
    production_description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("product__name_zh", "-version")
        constraints = (
            models.UniqueConstraint(fields=("product", "version"), name="unique_product_recipe_version"),
            models.UniqueConstraint(
                fields=("product",),
                condition=Q(is_active=True),
                name="unique_active_recipe_per_product",
            ),
        )

    @property
    def total_weight(self) -> Decimal:
        total = RecipeIngredient.objects.filter(section__recipe=self).aggregate(total=Sum("weight"))["total"]
        return total or Decimal("0")

    def __str__(self) -> str:
        return f"{self.product.name_zh} V{self.version}"


class RecipeSection(BaseModel):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="sections")
    name = models.CharField(max_length=100)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "name")
        constraints = (
            models.UniqueConstraint(fields=("recipe", "name"), name="unique_recipe_section_name"),
            models.UniqueConstraint(fields=("recipe", "position"), name="unique_recipe_section_position"),
        )

    def __str__(self) -> str:
        return f"{self.recipe}: {self.name}"


class RecipeIngredient(BaseModel):
    section = models.ForeignKey(RecipeSection, on_delete=models.CASCADE, related_name="items")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="recipe_items")
    weight = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=(MinValueValidator(Decimal("0.001")),),
    )
    unit = models.CharField(max_length=16, default="g")
    estimated_price = models.DecimalField(max_digits=10, decimal_places=4, blank=True, null=True)
    position = models.PositiveIntegerField(default=0)
    preparation_note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("section__position", "position", "ingredient__name")
        constraints = (
            models.UniqueConstraint(fields=("section", "ingredient"), name="unique_ingredient_per_recipe_section"),
            models.UniqueConstraint(fields=("section", "position"), name="unique_recipe_ingredient_position"),
        )

    def __str__(self) -> str:
        return f"{self.ingredient.name} {self.weight}{self.unit}"
