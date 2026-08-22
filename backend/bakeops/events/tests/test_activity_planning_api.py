import json
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.events.models import ActivityCategory, ActivityPlatform


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
