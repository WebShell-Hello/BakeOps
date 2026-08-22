from datetime import date, time

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from bakeops.employees.models import Employee
from bakeops.scheduling.models import ScheduleEntry
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    admin = User.objects.create_superuser(
        username="schedule-admin",
        email="schedule-admin@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.mark.django_db
def test_schedule_crud_and_date_range(admin_client: APIClient) -> None:
    employee = Employee.objects.create(
        employee_number="110001",
        name="BingBing",
        date_of_birth="2001-05-03",
        position="Baker",
        hourly_rate="15.00",
        employment_type=Employee.EmploymentType.FULL_TIME,
        email="bingbing@bb.com",
        status=Employee.Status.ACTIVE,
    )
    create_response = admin_client.post(
        reverse("schedule-entry-list"),
        {
            "employee": str(employee.id),
            "work_date": "2026-08-15",
            "start_time": "08:00",
            "end_time": "16:30",
            "break_minutes": 30,
            "work_content": "Production and counter service",
        },
        format="json",
    )
    assert create_response.status_code == 201

    list_response = admin_client.get(
        reverse("schedule-entry-list"),
        {"date_from": "2026-08-01", "date_to": "2026-08-31"},
    )
    assert list_response.status_code == 200
    assert len(list_response.data) == 1

    entry = ScheduleEntry.objects.get()
    assert entry.employee_name == "BingBing"
    assert entry.work_date == date(2026, 8, 15)
    assert entry.start_time == time(8, 0)
    assert create_response.data["actual_hours"] == "8.00"
    assert create_response.data["daily_wage"] == "120.00"


@pytest.mark.django_db
def test_schedule_rejects_invalid_time_and_unbounded_queries(admin_client: APIClient) -> None:
    employee = Employee.objects.create(
        employee_number="110001",
        name="Joe",
        date_of_birth="2001-05-03",
        position="Sales",
        hourly_rate="12.00",
        employment_type=Employee.EmploymentType.PART_TIME,
        email="joe@jo.com",
        status=Employee.Status.ACTIVE,
    )
    invalid_shift = admin_client.post(
        reverse("schedule-entry-list"),
        {
            "employee": str(employee.id),
            "work_date": "2026-08-15",
            "start_time": "17:00",
            "end_time": "09:00",
            "work_content": "Invalid shift",
        },
        format="json",
    )
    missing_range = admin_client.get(reverse("schedule-entry-list"))

    assert invalid_shift.status_code == 400
    assert missing_range.status_code == 400
    assert ScheduleEntry.objects.count() == 0


@pytest.mark.django_db
def test_existing_schedule_can_be_updated_after_employee_leaves(admin_client: APIClient) -> None:
    employee = Employee.objects.create(
        employee_number="110001",
        name="Historical Employee",
        date_of_birth="2001-05-03",
        position="Sales",
        hourly_rate="12.00",
        employment_type=Employee.EmploymentType.PART_TIME,
        email="historical@he.com",
        status=Employee.Status.ACTIVE,
    )
    entry = ScheduleEntry.objects.create(
        employee=employee,
        employee_name=employee.name,
        work_date="2026-08-15",
        start_time="10:00",
        end_time="18:00",
    )
    employee.status = Employee.Status.DEPARTED
    employee.save(update_fields=("status",))

    response = admin_client.put(
        reverse("schedule-entry-detail", kwargs={"pk": entry.id}),
        {
            "employee": str(employee.id),
            "work_date": "2026-08-15",
            "start_time": "11:00",
            "end_time": "19:00",
            "work_content": "Historical shift updated",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["employee_name"] == "Historical Employee"


@pytest.mark.django_db
def test_schedule_must_fall_within_employment_dates(admin_client: APIClient) -> None:
    employee = Employee.objects.create(
        employee_number="110009",
        name="Former Employee",
        date_of_birth="1990-05-03",
        hire_date="2025-01-10",
        position="Sales",
        hourly_rate="12.00",
        employment_type=Employee.EmploymentType.PART_TIME,
        email="former-schedule@example.com",
        status=Employee.Status.ACTIVE,
    )
    before_hire = admin_client.post(
        reverse("schedule-entry-list"),
        {
            "employee": str(employee.id),
            "work_date": "2025-01-09",
            "start_time": "10:00",
            "end_time": "18:00",
        },
        format="json",
    )
    entry = ScheduleEntry.objects.create(
        employee=employee,
        employee_name=employee.name,
        work_date="2026-02-20",
        start_time="10:00",
        end_time="18:00",
    )
    employee.status = Employee.Status.DEPARTED
    employee.departure_date = date(2026, 2, 28)
    employee.save(update_fields=("status", "departure_date"))
    after_departure = admin_client.patch(
        reverse("schedule-entry-detail", kwargs={"pk": entry.id}),
        {
            "work_date": "2026-03-01",
        },
        format="json",
    )

    assert before_hire.status_code == 400
    assert after_departure.status_code == 400


@pytest.mark.django_db
def test_deleted_employee_is_hidden_from_schedule_options(admin_client: APIClient) -> None:
    active_employee = Employee.objects.create(
        employee_number="110001",
        name="Visible Employee",
        date_of_birth="2001-05-03",
        position="Sales",
        hourly_rate="12.00",
        employment_type=Employee.EmploymentType.PART_TIME,
        email="visible@ve.com",
        status=Employee.Status.ACTIVE,
    )
    deleted_employee = Employee.objects.create(
        employee_number="110002",
        name="Deleted Employee",
        date_of_birth="2001-05-03",
        position="Sales",
        hourly_rate="12.00",
        employment_type=Employee.EmploymentType.PART_TIME,
        email="deleted@de.com",
        status=Employee.Status.ACTIVE,
    )
    deleted_employee.soft_delete()
    Employee.objects.create(
        employee_number="110003",
        name="Future Employee",
        date_of_birth="2001-05-03",
        hire_date="2099-01-01",
        position="Sales",
        hourly_rate="12.00",
        employment_type=Employee.EmploymentType.PART_TIME,
        email="future@employee.com",
        status=Employee.Status.ACTIVE,
    )

    response = admin_client.get(reverse("schedule-employee-options"))

    assert response.status_code == 200
    assert {str(item["id"]) for item in response.data} == {str(active_employee.id)}


@pytest.mark.django_db
def test_schedule_entries_can_be_bulk_deleted(admin_client: APIClient) -> None:
    employee = Employee.objects.create(
        employee_number="110001",
        name="Bulk Delete Employee",
        date_of_birth="2001-05-03",
        position="Sales",
        hourly_rate="12.00",
        employment_type=Employee.EmploymentType.PART_TIME,
        email="bulk@delete.com",
        status=Employee.Status.ACTIVE,
    )
    entries = [
        ScheduleEntry.objects.create(
            employee=employee,
            employee_name=employee.name,
            work_date=f"2026-08-{day:02d}",
            start_time="10:00",
            end_time="18:00",
        )
        for day in (15, 16, 17)
    ]

    response = admin_client.post(
        reverse("schedule-bulk-delete"),
        {"schedule_ids": [str(entries[0].id), str(entries[2].id)]},
        format="json",
    )

    assert response.status_code == 204
    assert list(ScheduleEntry.objects.values_list("id", flat=True)) == [entries[1].id]
