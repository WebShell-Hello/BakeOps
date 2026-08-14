from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from bakeops.common.models import BaseModel


class Holiday(BaseModel):
    code = models.CharField(max_length=80, unique=True)
    name_zh = models.CharField(max_length=160)
    name_en = models.CharField(max_length=160)
    holiday_date = models.DateField(db_index=True)
    region = models.CharField(max_length=40, default="England and Wales")
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("holiday_date", "name_en")

    def __str__(self) -> str:
        return f"{self.name_en} · {self.holiday_date}"


class BusinessEvent(BaseModel):
    class EventType(models.TextChoices):
        PROMOTION = "PROMOTION", "Promotion"
        KOL_COLLABORATION = "KOL_COLLABORATION", "KOL collaboration"
        CUSTOMER_LOYALTY = "CUSTOMER_LOYALTY", "Customer loyalty"
        PRODUCT_LAUNCH = "PRODUCT_LAUNCH", "Product launch"
        MEMBER_EVENT = "MEMBER_EVENT", "Member event"
        MARKETING = "MARKETING", "Advertising and marketing"
        SPECIAL_ORDER = "SPECIAL_ORDER", "Special order"
        OFFLINE_PARTNERSHIP = "OFFLINE_PARTNERSHIP", "Offline partnership"
        OTHER = "OTHER", "Other"

    class Impact(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"

    name = models.CharField(max_length=180)
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    preparation_days = models.PositiveSmallIntegerField(default=14)
    expected_impact = models.CharField(max_length=12, choices=Impact.choices, default=Impact.MEDIUM)
    expected_sales_change = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("0"),
        validators=(MinValueValidator(Decimal("-100")), MaxValueValidator(Decimal("999.99"))),
    )
    focus_products = models.ManyToManyField("products.Product", blank=True, related_name="business_events")
    estimated_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        validators=(MinValueValidator(Decimal("0")),),
    )
    currency = models.CharField(max_length=3, default="GBP")
    notes = models.TextField(blank=True)
    linked_holiday = models.ForeignKey(
        Holiday,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="business_events",
    )
    created_by = models.ForeignKey(
        "users.User",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="business_events_created",
    )

    class Meta:
        ordering = ("start_date", "name")
        permissions = (("manage_events", "Can manage events and business calendar"),)
        constraints = (
            models.CheckConstraint(condition=Q(end_date__gte=F("start_date")), name="event_end_on_or_after_start"),
        )

    def __str__(self) -> str:
        return self.name


class EventChecklistItem(BaseModel):
    class Category(models.TextChoices):
        PRODUCT_PRODUCTION = "PRODUCT_PRODUCTION", "Products and production"
        INVENTORY_PURCHASING = "INVENTORY_PURCHASING", "Inventory and purchasing"
        STORE_OPERATIONS = "STORE_OPERATIONS", "Store operations"
        MARKETING = "MARKETING", "Marketing"

    event = models.ForeignKey(BusinessEvent, on_delete=models.CASCADE, related_name="checklist_items")
    category = models.CharField(max_length=32, choices=Category.choices)
    title_zh = models.CharField(max_length=180)
    title_en = models.CharField(max_length=180)
    is_completed = models.BooleanField(default=False)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("category", "position", "created_at")
        constraints = (
            models.UniqueConstraint(fields=("event", "category", "position"), name="unique_event_checklist_position"),
        )

    def __str__(self) -> str:
        return self.title_en


class BusinessClosure(BaseModel):
    class ClosureType(models.TextChoices):
        REST_DAY = "REST_DAY", "Rest day"
        TEMPORARY_CLOSURE = "TEMPORARY_CLOSURE", "Temporary closure"
        STAFF_LEAVE = "STAFF_LEAVE", "Staff leave"
        MAINTENANCE = "MAINTENANCE", "Equipment maintenance"
        RENOVATION = "RENOVATION", "Renovation"
        OTHER = "OTHER", "Other"

    name = models.CharField(max_length=180)
    closure_type = models.CharField(max_length=24, choices=ClosureType.choices)
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "users.User",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="business_closures_created",
    )

    class Meta:
        ordering = ("start_date", "name")
        constraints = (
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")),
                name="closure_end_on_or_after_start",
            ),
        )

    def __str__(self) -> str:
        return self.name
