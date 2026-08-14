from datetime import time

import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APIClient

from bakeops.employees.models import Employee
from bakeops.scheduling.models import ScheduleEntry
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    admin = User.objects.create_superuser(
        username="employee-admin",
        email="employee-admin@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.mark.django_db
def test_seed_and_filter_active_employees(admin_client: APIClient) -> None:
    call_command("seed_demo_employees")
    employee = Employee.objects.get(employee_number="110002")
    employee.status = Employee.Status.ON_LEAVE
    employee.save(update_fields=("status",))

    response = admin_client.get(reverse("employee-list"), {"status": Employee.Status.ACTIVE})

    assert response.status_code == 200
    assert len(response.data) == 3
    assert all(item["status"] == Employee.Status.ACTIVE for item in response.data)


@pytest.mark.django_db
def test_employee_create_and_update(admin_client: APIClient) -> None:
    response = admin_client.post(
        reverse("employee-list"),
        {
            "employee_number": "110007",
            "name": "测试员工",
            "gender": "UNSPECIFIED",
            "date_of_birth": "2001-05-03",
            "hire_date": "2026-08-01",
            "departure_date": None,
            "position": "销售",
            "hourly_rate": "12.50",
            "employment_type": "PART_TIME",
            "email": "test@te.com",
            "status": "ACTIVE",
        },
        format="json",
    )
    assert response.status_code == 201

    update = admin_client.put(
        reverse("employee-detail", kwargs={"pk": response.data["id"]}),
        {**response.data, "status": "SUSPENDED"},
        format="json",
    )
    assert update.status_code == 200
    assert update.data["status"] == "SUSPENDED"


@pytest.mark.django_db
def test_departed_employee_requires_valid_employment_dates(admin_client: APIClient) -> None:
    response = admin_client.post(
        reverse("employee-list"),
        {
            "employee_number": "110008",
            "name": "Former Employee",
            "gender": "UNSPECIFIED",
            "date_of_birth": "1990-05-03",
            "hire_date": "2025-01-10",
            "departure_date": "2024-12-31",
            "position": "Sales",
            "hourly_rate": "12.50",
            "employment_type": "PART_TIME",
            "email": "former@example.com",
            "status": "DEPARTED",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "departure_date" in response.data


@pytest.mark.django_db
def test_employee_can_be_soft_deleted_and_restored(admin_client: APIClient) -> None:
    call_command("seed_demo_employees")
    employee = Employee.objects.get(employee_number="110001")

    delete_response = admin_client.delete(
        reverse("employee-detail", kwargs={"pk": employee.id}),
    )
    active_response = admin_client.get(reverse("employee-list"))
    deleted_response = admin_client.get(reverse("employee-list"), {"deleted": "true"})

    employee.refresh_from_db()
    assert delete_response.status_code == 204
    assert employee.deleted_at is not None
    assert str(employee.id) not in {item["id"] for item in active_response.data}
    assert str(employee.id) in {item["id"] for item in deleted_response.data}

    restore_response = admin_client.post(
        reverse("employee-restore", kwargs={"pk": employee.id}),
    )

    employee.refresh_from_db()
    assert restore_response.status_code == 200
    assert employee.deleted_at is None


@pytest.mark.django_db
def test_deleted_employee_schedule_history_remains_available(admin_client: APIClient) -> None:
    call_command("seed_demo_employees")
    employee = Employee.objects.get(employee_number="110001")
    ScheduleEntry.objects.create(
        employee=employee,
        employee_name=employee.name,
        work_date="2026-08-10",
        start_time=time(7, 0),
        end_time=time(16, 0),
        break_minutes=60,
    )
    employee.soft_delete()

    response = admin_client.get(
        reverse("employee-schedule-history", kwargs={"pk": employee.id})
    )

    assert response.status_code == 200
    assert response.data["employee"]["deleted_at"] is not None
    assert response.data["summary"]["shift_count"] == 1
    assert response.data["summary"]["actual_hours"] == "8.00"
    assert response.data["summary"]["total_wage"] == "120.00"
    assert response.data["entries"][0]["employee_is_deleted"] is True


@pytest.mark.django_db
def test_employee_bulk_delete_and_restore(admin_client: APIClient) -> None:
    call_command("seed_demo_employees")
    employee_ids = list(Employee.objects.values_list("id", flat=True)[:2])

    delete_response = admin_client.post(
        reverse("employee-bulk-delete"),
        {"employee_ids": [str(employee_id) for employee_id in employee_ids]},
        format="json",
    )
    assert delete_response.status_code == 204
    assert Employee.objects.filter(id__in=employee_ids, deleted_at__isnull=False).count() == 2

    restore_response = admin_client.post(
        reverse("employee-bulk-restore"),
        {"employee_ids": [str(employee_id) for employee_id in employee_ids]},
        format="json",
    )
    assert restore_response.status_code == 204
    assert Employee.objects.filter(id__in=employee_ids, deleted_at__isnull=True).count() == 2
