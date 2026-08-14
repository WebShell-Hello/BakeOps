from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q

from bakeops.common.models import BaseModel


class ScheduleEntry(BaseModel):
    employee = models.ForeignKey(
        "employees.Employee",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="schedule_entries",
    )
    employee_name = models.CharField(max_length=120)
    work_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveSmallIntegerField(default=0, validators=(MinValueValidator(0),))
    work_content = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="schedule_entries_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="schedule_entries_updated",
    )

    class Meta:
        ordering = ("work_date", "start_time", "employee_name")
        indexes = (
            models.Index(fields=("work_date", "start_time"), name="schedule_date_time_idx"),
            models.Index(fields=("employee_name", "work_date"), name="schedule_employee_date_idx"),
        )
        constraints = (
            models.CheckConstraint(condition=Q(end_time__gt=F("start_time")), name="schedule_end_after_start"),
        )
        permissions = (("manage_schedules", "Can manage staff schedules"),)

    def __str__(self) -> str:
        return f"{self.employee_name} · {self.work_date} {self.start_time:%H:%M}"
