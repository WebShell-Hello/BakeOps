from decimal import Decimal

from django.conf import settings

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


class ActivityCategory(BaseModel):
    code = models.CharField(max_length=60, unique=True)
    name_zh = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    colour = models.CharField(max_length=20, default="blue")
    icon_key = models.CharField(max_length=40, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("position", "name_en")

    def __str__(self) -> str:
        return self.name_en


class ActivityPlatform(BaseModel):
    category = models.ForeignKey(ActivityCategory, on_delete=models.PROTECT, related_name="platforms")
    code = models.CharField(max_length=60, unique=True)
    name_zh = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    position = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("category__position", "position", "name_en")

    def __str__(self) -> str:
        return self.name_en


class ActivityPlan(BaseModel):
    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        PAUSED = "PAUSED", "Paused"
        ENDED = "ENDED", "Ended"

    name = models.CharField(max_length=180)
    category = models.ForeignKey(ActivityCategory, on_delete=models.PROTECT, related_name="activity_plans")
    platform = models.ForeignKey(ActivityPlatform, on_delete=models.PROTECT, related_name="activity_plans")
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=12, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(blank=True, null=True, db_index=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="owned_activity_plans",
    )
    responsible_employee = models.ForeignKey(
        "employees.Employee",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="assigned_activity_plans",
    )
    linked_business_event = models.ForeignKey(
        BusinessEvent,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="activity_plans",
    )
    focus_products = models.ManyToManyField("products.Product", blank=True, related_name="activity_plans")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="activity_plans_created",
    )

    class Meta:
        ordering = ("status", "name")
        permissions = (("manage_activity_plans", "Can manage activity plans and reminders"),)
        constraints = (
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(end_date__gte=F("start_date")),
                name="activity_plan_end_on_or_after_start",
            ),
        )

    def __str__(self) -> str:
        return self.name


class ActivityReminderRule(BaseModel):
    class Frequency(models.TextChoices):
        ONCE = "ONCE", "Once"
        DAILY = "DAILY", "Daily"
        WEEKLY = "WEEKLY", "Weekly"
        MONTHLY = "MONTHLY", "Monthly"

    plan = models.OneToOneField(ActivityPlan, on_delete=models.CASCADE, related_name="reminder_rule")
    frequency = models.CharField(max_length=12, choices=Frequency.choices)
    interval = models.PositiveSmallIntegerField(default=1, validators=(MinValueValidator(1), MaxValueValidator(52)))
    weekdays = models.JSONField(default=list, blank=True)
    month_days = models.JSONField(default=list, blank=True)
    reminder_time = models.TimeField()
    timezone = models.CharField(max_length=64, default="Europe/London")
    is_enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ("plan__name",)

    def __str__(self) -> str:
        return f"{self.plan.name} · {self.frequency}"


class ActivityReminderOccurrence(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        SKIPPED = "SKIPPED", "Skipped"
        CANCELLED = "CANCELLED", "Cancelled"

    plan = models.ForeignKey(ActivityPlan, on_delete=models.CASCADE, related_name="occurrences")
    rule = models.ForeignKey(ActivityReminderRule, on_delete=models.CASCADE, related_name="occurrences")
    scheduled_at = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="completed_activity_reminders",
    )
    execution_notes = models.TextField(blank=True)
    result_url = models.URLField(blank=True)
    snoozed_until = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("scheduled_at", "plan__name")
        constraints = (
            models.UniqueConstraint(fields=("rule", "scheduled_at"), name="unique_activity_rule_occurrence"),
        )

    def __str__(self) -> str:
        return f"{self.plan.name} · {self.scheduled_at}"
