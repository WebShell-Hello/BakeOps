from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from bakeops.employees.models import Employee

DEMO_EMPLOYEES = (
    (
        "110000",
        "bing王",
        "MALE",
        "1992-11-08",
        "面点师",
        "15.00",
        "FULL_TIME",
        "bingwang@bw.com",
        "2023-03-20",
        "ACTIVE",
        None,
    ),
    (
        "110001",
        "张三",
        "MALE",
        "1989-06-12",
        "面点师",
        "15.00",
        "FULL_TIME",
        "zhangsan@zs.com",
        "2024-01-08",
        "ACTIVE",
        None,
    ),
    (
        "110002",
        "李四",
        "FEMALE",
        "1998-02-21",
        "销售",
        "12.00",
        "PART_TIME",
        "lisi@ls.com",
        "2024-09-02",
        "ACTIVE",
        None,
    ),
    (
        "110003",
        "王五",
        "MALE",
        "1995-09-17",
        "销售",
        "12.00",
        "PART_TIME",
        "wangwu@ww.com",
        "2024-06-17",
        "DEPARTED",
        "2026-02-28",
    ),
    (
        "110004",
        "小G",
        "FEMALE",
        "2000-04-03",
        "销售",
        "12.00",
        "PART_TIME",
        "xiaog@xg.com",
        "2025-04-14",
        "ACTIVE",
        None,
    ),
    (
        "110005",
        "史蒂芬",
        "MALE",
        "1993-12-26",
        "销售",
        "12.00",
        "PART_TIME",
        "shidifen@sdf.com",
        "2025-02-03",
        "DEPARTED",
        "2026-05-31",
    ),
)


class Command(BaseCommand):
    help = "Create or refresh the six BakeOps demo employees."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        for (
            employee_number,
            name,
            gender,
            date_of_birth,
            position,
            hourly_rate,
            employment_type,
            email,
            hire_date,
            status,
            departure_date,
        ) in DEMO_EMPLOYEES:
            Employee.objects.update_or_create(
                employee_number=employee_number,
                defaults={
                    "name": name,
                    "gender": gender,
                    "date_of_birth": date_of_birth,
                    "hire_date": hire_date,
                    "departure_date": departure_date,
                    "position": position,
                    "hourly_rate": hourly_rate,
                    "employment_type": employment_type,
                    "email": email,
                    "status": status,
                },
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(DEMO_EMPLOYEES)} demo employees."))
