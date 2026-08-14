from datetime import date, time, timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from bakeops.employees.models import Employee
from bakeops.scheduling.models import ScheduleEntry

BAKERS = ("张三", "bing王")
SALES_STAFF = ("李四", "王五", "小G", "史蒂芬")
SALES_ROTATION = (
    ("李四", "王五"),
    ("小G", "史蒂芬"),
    ("李四", "小G"),
    ("王五", "史蒂芬"),
    ("李四", "史蒂芬"),
    ("王五", "小G"),
)
SCHEDULE_START = date(2025, 8, 15)
SCHEDULE_END = date(2026, 8, 14)


def employed_on(employee: Employee, work_date: date) -> bool:
    return employee.hire_date <= work_date and (employee.departure_date is None or work_date <= employee.departure_date)


def sales_for_day(employee_by_name: dict[str, Employee], work_date: date, day_index: int) -> list[str]:
    available = [
        name for name in SALES_STAFF if name in employee_by_name and employed_on(employee_by_name[name], work_date)
    ]
    preferred = [name for name in SALES_ROTATION[day_index % len(SALES_ROTATION)] if name in available]
    return [*preferred, *(name for name in available if name not in preferred)][:2]


class Command(BaseCommand):
    help = "Seed one year of payable demo schedules through 14 August 2026."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        employee_by_name = {employee.name: employee for employee in Employee.objects.all()}
        start = SCHEDULE_START
        end = SCHEDULE_END
        current = start
        day_index = 0
        created = 0
        updated = 0

        for employee in employee_by_name.values():
            if employee.departure_date is not None:
                ScheduleEntry.objects.filter(
                    employee=employee,
                    work_date__gt=employee.departure_date,
                ).delete()

        while current <= end:
            baker_names = [
                name for name in BAKERS if name in employee_by_name and employed_on(employee_by_name[name], current)
            ]
            sales_names = sales_for_day(employee_by_name, current, day_index)
            daily_assignments = [
                *((name, time(7, 0), time(16, 0), 60, "面点制作 · 备料、制作与出品") for name in baker_names),
                *((name, time(9, 30), time(18, 0), 30, "门店销售 · 接待、收银与闭店整理") for name in sales_names),
            ]
            for employee_name, start_time, end_time, break_minutes, work_content in daily_assignments:
                entry = ScheduleEntry.objects.filter(employee_name=employee_name, work_date=current).first()
                if entry is None:
                    ScheduleEntry.objects.create(
                        employee=employee_by_name.get(employee_name),
                        employee_name=employee_name,
                        work_date=current,
                        start_time=start_time,
                        end_time=end_time,
                        break_minutes=break_minutes,
                        work_content=work_content,
                    )
                    created += 1
                else:
                    entry.employee = employee_by_name.get(employee_name)
                    entry.start_time = start_time
                    entry.end_time = end_time
                    entry.break_minutes = break_minutes
                    entry.work_content = work_content
                    entry.save(
                        update_fields=(
                            "employee",
                            "start_time",
                            "end_time",
                            "break_minutes",
                            "work_content",
                            "updated_at",
                        )
                    )
                    updated += 1
            current += timedelta(days=1)
            day_index += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded schedules for {start.isoformat()} to {end.isoformat()}: {created} created, {updated} updated."
            )
        )
