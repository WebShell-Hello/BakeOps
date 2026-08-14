from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from bakeops.common.models import BaseModel


class CostItem(BaseModel):
    class Category(models.TextChoices):
        RENT = "RENT", "Rent"
        UTILITIES = "UTILITIES", "Utilities"
        INSURANCE = "INSURANCE", "Insurance"
        SOFTWARE = "SOFTWARE", "Software"
        MAINTENANCE = "MAINTENANCE", "Maintenance"
        CLEANING = "CLEANING", "Cleaning"
        ACCOUNTING = "ACCOUNTING", "Accounting"
        EQUIPMENT_RENTAL = "EQUIPMENT_RENTAL", "Equipment rental"
        WASTE = "WASTE", "Waste disposal"
        MATERIALS = "MATERIALS", "Ingredients and materials"
        OTHER = "OTHER", "Other"

    name_zh = models.CharField(max_length=120, unique=True)
    name_en = models.CharField(max_length=120, unique=True)
    category = models.CharField(max_length=24, choices=Category.choices)
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("category", "name_en")
        permissions = (("manage_costs", "Can manage operating costs"),)

    def __str__(self) -> str:
        return self.name_en


class CostMonth(BaseModel):
    month = models.DateField(unique=True)

    class Meta:
        ordering = ("-month",)

    def save(self, *args, **kwargs) -> None:
        self.month = self.month.replace(day=1)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.month.strftime("%Y-%m")


class MonthlyCost(BaseModel):
    cost_item = models.ForeignKey(
        CostItem,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="monthly_costs",
    )
    name_zh = models.CharField(max_length=120, default="")
    name_en = models.CharField(max_length=120, default="")
    category = models.CharField(max_length=24, choices=CostItem.Category.choices, default=CostItem.Category.OTHER)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=(MinValueValidator(Decimal("0.00")),),
    )
    incurred_date = models.DateField()
    cost_month = models.DateField(editable=False)
    notes = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="monthly_costs_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="monthly_costs_updated",
    )

    class Meta:
        ordering = ("incurred_date", "name_en")
        indexes = (models.Index(fields=("incurred_date",), name="cost_incurred_date_idx"),)
        constraints = (
            models.UniqueConstraint(
                fields=("cost_item", "cost_month"),
                name="unique_cost_item_per_month",
            ),
            models.UniqueConstraint(
                fields=("cost_month", "name_zh"),
                name="unique_monthly_cost_name_zh",
            ),
            models.UniqueConstraint(
                fields=("cost_month", "name_en"),
                name="unique_monthly_cost_name_en",
            ),
        )

    def save(self, *args, **kwargs) -> None:
        self.cost_month = self.incurred_date.replace(day=1)
        if self.cost_item_id:
            self.name_zh = self.name_zh or self.cost_item.name_zh
            self.name_en = self.name_en or self.cost_item.name_en
            self.category = self.category or self.cost_item.category
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name_en} · {self.incurred_date} · {self.amount}"
