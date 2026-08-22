import json
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.employees.models import Employee
from bakeops.events.models import ActivityCategory, ActivityPlan, ActivityPlatform


@pytest.fixture
def activity_options() -> tuple[ActivityCategory, ActivityPlatform]:
    category = ActivityCategory.objects.create(
        code="TEST_SOCIAL",
        name_zh="测试社交媒体",
        name_en="Test Social Media",
    )
    platform = ActivityPlatform.objects.create(
        category=category,
        code="TEST_XHS",
        name_zh="测试小红书",
        name_en="Test Xiaohongshu",
    )
    return category, platform


@pytest.mark.django_db
def test_activity_category_and_platform_can_be_created_inline(admin_client: APIClient) -> None:
    category_response = admin_client.post(
        reverse("activity-category-list-create"),
        json.dumps({"name": "Community promotion"}),
        content_type="application/json",
    )
    assert category_response.status_code == 201
    assert category_response.data["name_zh"] == "Community promotion"
    assert category_response.data["name_en"] == "Community promotion"

    platform_response = admin_client.post(
        reverse("activity-platform-list-create"),
        json.dumps({
            "category_id": str(category_response.data["id"]),
            "name": "Neighbourhood board",
        }),
        content_type="application/json",
    )
    assert platform_response.status_code == 201
    assert platform_response.data["category_id"] == category_response.data["id"]
    assert platform_response.data["name_zh"] == "Neighbourhood board"

    duplicate_response = admin_client.post(
        reverse("activity-platform-list-create"),
        json.dumps({
            "category_id": str(category_response.data["id"]),
            "name": "neighbourhood BOARD",
        }),
        content_type="application/json",
    )
    assert duplicate_response.status_code == 400
    assert "name" in duplicate_response.data


@pytest.mark.django_db
def test_unused_activity_options_can_be_deleted(admin_client: APIClient) -> None:
    category = ActivityCategory.objects.create(
        code="DELETE_CATEGORY",
        name_zh="待删除分类",
        name_en="Category to delete",
    )
    platform = ActivityPlatform.objects.create(
        category=category,
        code="DELETE_PLATFORM",
        name_zh="待删除平台",
        name_en="Platform to delete",
    )

    category_in_use_response = admin_client.delete(reverse("activity-category-detail", args=(category.id,)))
    platform_response = admin_client.delete(reverse("activity-platform-detail", args=(platform.id,)))
    category_response = admin_client.delete(reverse("activity-category-detail", args=(category.id,)))

    assert category_in_use_response.status_code == 409
    assert platform_response.status_code == 204
    assert category_response.status_code == 204
    assert not ActivityCategory.objects.filter(pk=category.id).exists()


@pytest.mark.django_db
def test_activity_options_used_by_a_plan_cannot_be_deleted(
    admin_client: APIClient,
    activity_options: tuple[ActivityCategory, ActivityPlatform],
) -> None:
    category, platform = activity_options
    ActivityPlan.objects.create(
        name="Protected activity plan",
        category=category,
        platform=platform,
        start_date=timezone.localdate(),
    )

    platform_response = admin_client.delete(reverse("activity-platform-detail", args=(platform.id,)))
    category_response = admin_client.delete(reverse("activity-category-detail", args=(category.id,)))

    assert platform_response.status_code == 409
    assert category_response.status_code == 409
    assert ActivityPlatform.objects.filter(pk=platform.id).exists()
    assert ActivityCategory.objects.filter(pk=category.id).exists()


@pytest.mark.django_db
def test_activity_owner_options_only_include_active_employees(
    admin_client: APIClient,
    activity_options: tuple[ActivityCategory, ActivityPlatform],
) -> None:
    category, platform = activity_options
    active = Employee.objects.create(
        employee_number="9101",
        name="Active Owner",
        position="Marketing",
        hourly_rate="15.00",
        employment_type=Employee.EmploymentType.FULL_TIME,
        status=Employee.Status.ACTIVE,
    )
    Employee.objects.create(
        employee_number="9102",
        name="On Leave",
        position="Operations",
        hourly_rate="15.00",
        employment_type=Employee.EmploymentType.FULL_TIME,
        status=Employee.Status.ON_LEAVE,
    )
    Employee.objects.create(
        employee_number="9103",
        name="Deleted Active Employee",
        position="Former Marketing",
        hourly_rate="15.00",
        employment_type=Employee.EmploymentType.FULL_TIME,
        status=Employee.Status.ACTIVE,
        deleted_at=timezone.now(),
    )
    today = timezone.localdate()

    overview = admin_client.get(
        reverse("activity-planning-overview"),
        {"start": today.isoformat(), "end": today.isoformat()},
    )
    create_response = admin_client.post(
        reverse("activity-plan-list-create"),
        json.dumps({
            "name": "Assigned campaign",
            "category_id": str(category.id),
            "platform_id": str(platform.id),
            "priority": "NORMAL",
            "status": "ACTIVE",
            "start_date": today.isoformat(),
            "owner_id": str(active.id),
            "focus_product_ids": [],
            "reminder_rule": {
                "frequency": "ONCE",
                "interval": 1,
                "weekdays": [],
                "month_days": [],
                "reminder_time": "10:00",
                "timezone": "Europe/London",
                "is_enabled": True,
            },
        }),
        content_type="application/json",
    )

    assert overview.status_code == 200
    assert overview.data["owner_options"] == [
        {"id": active.id, "name": "Active Owner", "position": "Marketing"},
    ]
    assert create_response.status_code == 201
    assert create_response.data["owner_id"] == active.id
    assert create_response.data["owner_name"] == "Active Owner"


@pytest.mark.django_db
def test_weekly_activity_plan_generates_selected_weekdays(
    admin_client: APIClient,
    activity_options: tuple[ActivityCategory, ActivityPlatform],
) -> None:
    category, platform = activity_options
    monday = timezone.localdate() - timedelta(days=timezone.localdate().isoweekday() - 1)
    payload = {
        "name": "Weekly social posts",
        "category_id": str(category.id),
        "platform_id": str(platform.id),
        "description": "Post twice a week",
        "priority": "NORMAL",
        "status": "ACTIVE",
        "start_date": monday.isoformat(),
        "end_date": None,
        "owner_id": None,
        "focus_product_ids": [],
        "reminder_rule": {
            "frequency": "WEEKLY",
            "interval": 1,
            "weekdays": [1, 4],
            "month_days": [],
            "reminder_time": "10:00",
            "timezone": "Europe/London",
            "is_enabled": True,
        },
    }

    create_response = admin_client.post(
        reverse("activity-plan-list-create"),
        json.dumps(payload),
        content_type="application/json",
    )
    overview_response = admin_client.get(
        reverse("activity-planning-overview"),
        {"start": monday.isoformat(), "end": (monday + timedelta(days=6)).isoformat()},
    )

    assert create_response.status_code == 201
    assert overview_response.status_code == 200
    assert [item["effective_at"][:10] for item in overview_response.data["occurrences"]] == [
        monday.isoformat(),
        (monday + timedelta(days=3)).isoformat(),
    ]
    assert overview_response.data["kpis"]["active_plans"] == 1


@pytest.mark.django_db
def test_activity_rule_validates_platform_and_month_days(
    admin_client: APIClient,
    activity_options: tuple[ActivityCategory, ActivityPlatform],
) -> None:
    category, platform = activity_options
    other_category = ActivityCategory.objects.create(code="OTHER_TEST", name_zh="其他", name_en="Other")
    payload = {
        "name": "Invalid plan",
        "category_id": str(other_category.id),
        "platform_id": str(platform.id),
        "priority": "NORMAL",
        "status": "ACTIVE",
        "start_date": timezone.localdate().isoformat(),
        "focus_product_ids": [],
        "reminder_rule": {
            "frequency": "DAILY",
            "interval": 1,
            "weekdays": [],
            "month_days": [],
            "reminder_time": "10:00",
            "timezone": "Europe/London",
            "is_enabled": True,
        },
    }

    platform_response = admin_client.post(
        reverse("activity-plan-list-create"),
        json.dumps(payload),
        content_type="application/json",
    )

    assert platform_response.status_code == 400
    assert "platform_id" in platform_response.data

    payload["category_id"] = str(category.id)
    payload["reminder_rule"]["frequency"] = "MONTHLY"
    monthly_response = admin_client.post(
        reverse("activity-plan-list-create"),
        json.dumps(payload),
        content_type="application/json",
    )

    assert monthly_response.status_code == 400
    assert "month_days" in monthly_response.data["reminder_rule"]


@pytest.mark.django_db
def test_activity_occurrence_can_be_completed(
    admin_client: APIClient,
    activity_options: tuple[ActivityCategory, ActivityPlatform],
) -> None:
    category, platform = activity_options
    today = timezone.localdate()
    create_response = admin_client.post(
        reverse("activity-plan-list-create"),
        json.dumps({
            "name": "One-off poster",
            "category_id": str(category.id),
            "platform_id": str(platform.id),
            "priority": "HIGH",
            "status": "ACTIVE",
            "start_date": today.isoformat(),
            "focus_product_ids": [],
            "reminder_rule": {
                "frequency": "ONCE",
                "interval": 1,
                "weekdays": [],
                "month_days": [],
                "reminder_time": "23:59",
                "timezone": "Europe/London",
                "is_enabled": True,
            },
        }),
        content_type="application/json",
    )
    assert create_response.status_code == 201
    overview = admin_client.get(
        reverse("activity-planning-overview"),
        {"start": today.isoformat(), "end": today.isoformat()},
    )
    occurrence_id = overview.data["occurrences"][0]["id"]

    response = admin_client.patch(
        reverse("activity-occurrence-detail", args=(occurrence_id,)),
        json.dumps({"status": "COMPLETED", "execution_notes": "Poster replaced"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.data["status"] == "COMPLETED"
    assert response.data["display_status"] == "COMPLETED"
    assert response.data["completed_at"] is not None


@pytest.mark.django_db
def test_snooze_skips_current_occurrence_when_same_plan_exists_tomorrow(
    admin_client: APIClient,
    activity_options: tuple[ActivityCategory, ActivityPlatform],
) -> None:
    category, platform = activity_options
    today = timezone.localdate()
    create_response = admin_client.post(
        reverse("activity-plan-list-create"),
        json.dumps({
            "name": "Daily social post",
            "category_id": str(category.id),
            "platform_id": str(platform.id),
            "priority": "NORMAL",
            "status": "ACTIVE",
            "start_date": today.isoformat(),
            "focus_product_ids": [],
            "reminder_rule": {
                "frequency": "DAILY",
                "interval": 1,
                "weekdays": [],
                "month_days": [],
                "reminder_time": "10:00",
                "timezone": "Europe/London",
                "is_enabled": True,
            },
        }),
        content_type="application/json",
    )
    assert create_response.status_code == 201

    overview = admin_client.get(
        reverse("activity-planning-overview"),
        {"start": today.isoformat(), "end": (today + timedelta(days=1)).isoformat()},
    )
    current_occurrence, tomorrow_occurrence = overview.data["occurrences"]

    response = admin_client.patch(
        reverse("activity-occurrence-detail", args=(current_occurrence["id"],)),
        json.dumps({
            "status": "PENDING",
            "snoozed_until": tomorrow_occurrence["scheduled_at"],
        }),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.data["snooze_conflict"] is True
    assert response.data["status"] == "SKIPPED"
    assert response.data["display_status"] == "SKIPPED"
    assert response.data["snoozed_until"] is None

    refreshed_overview = admin_client.get(
        reverse("activity-planning-overview"),
        {"start": today.isoformat(), "end": (today + timedelta(days=1)).isoformat()},
    )
    refreshed = {item["id"]: item for item in refreshed_overview.data["occurrences"]}
    assert refreshed[current_occurrence["id"]]["status"] == "SKIPPED"
    assert refreshed[tomorrow_occurrence["id"]]["status"] == "PENDING"
