from collections import Counter
from datetime import time

import pytest
from django.core.management import call_command

from bakeops.employees.models import Employee
from bakeops.scheduling.management.commands.seed_demo_schedules import (
    BAKERS,
    SALES_STAFF,
    SCHEDULE_END,
    SCHEDULE_START,
)
from bakeops.scheduling.models import ScheduleEntry


@pytest.mark.django_db
def test_demo_schedule_covers_past_year_and_retains_departed_staff_history() -> None:
    call_command("seed_demo_employees")
    call_command("seed_demo_schedules")
    call_command("seed_demo_schedules")

    entries = ScheduleEntry.objects.filter(work_date__range=(SCHEDULE_START, SCHEDULE_END))
    assert entries.count() == 1460
    assert not entries.filter(employee__isnull=True).exists()

    dates = entries.order_by("work_date").values_list("work_date", flat=True).distinct()
    assert len(dates) == 365
    for work_date in dates:
        daily_entries = list(entries.filter(work_date=work_date))
        assert len(daily_entries) == 4
        assert {entry.employee_name for entry in daily_entries if entry.employee_name in BAKERS} == set(BAKERS)
        assert len([entry for entry in daily_entries if entry.employee_name in SALES_STAFF]) == 2
        assert all(
            entry.start_time == time(7, 0)
            and entry.end_time == time(16, 0)
            and entry.break_minutes == 60
            for entry in daily_entries
            if entry.employee_name in BAKERS
        )
        assert all(
            entry.start_time == time(9, 30)
            and entry.end_time == time(18, 0)
            and entry.break_minutes == 30
            for entry in daily_entries
            if entry.employee_name in SALES_STAFF
        )

    sales_counts = Counter(entries.filter(employee_name__in=SALES_STAFF).values_list("employee_name", flat=True))
    assert all(sales_counts[name] > 0 for name in SALES_STAFF)

    departed = Employee.objects.filter(status=Employee.Status.DEPARTED)
    assert departed.count() == 2
    for employee in departed:
        historical = entries.filter(employee=employee)
        assert historical.exists()
        assert historical.order_by("-work_date").first().work_date <= employee.departure_date
        assert not ScheduleEntry.objects.filter(
            employee=employee,
            work_date__gt=employee.departure_date,
        ).exists()
