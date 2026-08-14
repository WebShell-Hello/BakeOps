from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from bakeops.common.models import BaseModel


class Employee(BaseModel):
    class Gender(models.TextChoices):
        UNSPECIFIED = "UNSPECIFIED", "Unspecified"
        FEMALE = "FEMALE", "Female"
        MALE = "MALE", "Male"
        OTHER = "OTHER", "Other"

    class EmploymentType(models.TextChoices):
        FULL_TIME = "FULL_TIME", "Full time"
        PART_TIME = "PART_TIME", "Part time"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ON_LEAVE = "ON_LEAVE", "On leave"
        DEPARTED = "DEPARTED", "Departed"
        SUSPENDED = "SUSPENDED", "Suspended"

    employee_number = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    gender = models.CharField(max_length=16, choices=Gender.choices, default=Gender.UNSPECIFIED)
    date_of_birth = models.DateField()
    hire_date = models.DateField(default=timezone.localdate)
    departure_date = models.DateField(null=True, blank=True)
    position = models.CharField(max_length=120)
    hourly_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0")),),
    )
    employment_type = models.CharField(max_length=16, choices=EmploymentType.choices)
    email = models.EmailField(unique=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("employee_number",)
        permissions = (("manage_employees", "Can manage bakery employees"),)
        indexes = (
            models.Index(fields=("status", "employee_number"), name="employee_status_number_idx"),
            models.Index(fields=("deleted_at", "employee_number"), name="employee_deleted_number_idx"),
        )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        if self.deleted_at is None:
            self.deleted_at = timezone.now()
            self.save(update_fields=("deleted_at", "updated_at"))

    def restore(self) -> None:
        if self.deleted_at is not None:
            self.deleted_at = None
            self.save(update_fields=("deleted_at", "updated_at"))

    def __str__(self) -> str:
        return f"{self.employee_number} · {self.name}"
