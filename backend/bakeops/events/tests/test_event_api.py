from datetime import timedelta

import pytest
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.events.models import BusinessClosure, BusinessEvent, EventChecklistItem, Holiday
from bakeops.inventory.models import InventoryItem, ProductionPlan
from bakeops.products.models import Ingredient, Product, Recipe, RecipeIngredient, RecipeSection
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    user = User.objects.create_superuser(
        username="event-admin",
        email="event-admin@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_create_event_generates_default_checklist(admin_client: APIClient) -> None:
    product = Product.objects.create(code="EVENT-PRODUCT", name_zh="活动产品", name_en="Event Product")
    start_date = timezone.localdate() + timedelta(days=10)

    response = admin_client.post(
        reverse("business-event-create"),
        {
            "name": "Test promotion",
            "event_type": "PROMOTION",
            "start_date": start_date.isoformat(),
            "end_date": (start_date + timedelta(days=2)).isoformat(),
            "preparation_days": 14,
            "expected_impact": "HIGH",
            "expected_sales_change": "20.00",
            "focus_product_ids": [str(product.id)],
            "estimated_cost": "500.00",
            "currency": "GBP",
            "notes": "Test notes",
        },
        format="json",
    )

    assert response.status_code == 201
    event = BusinessEvent.objects.get()
    assert event.focus_products.get() == product
    assert event.checklist_items.count() == 15
    assert response.data["checklist_total"] == 15
    assert response.data["status"] == "PREPARATION_RISK"


@pytest.mark.django_db
def test_event_detail_builds_production_and_inventory_advice(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Event advice flour", base_unit="g")
    product = Product.objects.create(code="ADVICE-PRODUCT", name_zh="建议产品", name_en="Advice Product")
    recipe = Recipe.objects.create(product=product, yield_quantity=10, is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="配方", position=0)
    RecipeIngredient.objects.create(section=section, ingredient=ingredient, weight="1000", unit="g", position=0)
    start_date = timezone.localdate() + timedelta(days=4)
    event = BusinessEvent.objects.create(
        name="Advice event",
        event_type=BusinessEvent.EventType.PROMOTION,
        start_date=start_date,
        end_date=start_date,
        expected_sales_change="20",
    )
    event.focus_products.add(product)
    ProductionPlan.objects.create(
        reference="PLAN-EVENT-ADVICE",
        product=product,
        planned_date=start_date,
        quantity=100,
    )
    InventoryItem.objects.create(ingredient=ingredient, quantity="11000")

    response = admin_client.get(reverse("business-event-detail", args=(event.id,)))

    assert response.status_code == 200
    production = response.data["production_suggestions"][0]
    assert production["current_quantity"] == 100
    assert production["suggested_quantity"] == 120
    assert production["suggested_increase"] == 20
    inventory = response.data["inventory_suggestions"][0]
    assert inventory["current_stock"] == "11.000"
    assert inventory["original_demand"] == "10.000"
    assert inventory["extra_demand"] == "2.000"
    assert inventory["recommended_additional_quantity"] == "1.000"
    assert inventory["recommendation"] == "INCREASE"


@pytest.mark.django_db
def test_business_closure_requires_explicit_production_override(admin_client: APIClient) -> None:
    product = Product.objects.create(code="CLOSED-PRODUCT", name_zh="停业产品", name_en="Closed Product")
    production_date = timezone.localdate() + timedelta(days=1)
    BusinessClosure.objects.create(
        name="Maintenance closure",
        closure_type=BusinessClosure.ClosureType.MAINTENANCE,
        start_date=production_date,
        end_date=production_date,
    )
    payload = {
        "production_date": production_date.isoformat(),
        "items": [{"product_id": str(product.id), "planned_quantity": 20}],
        "notes": "",
    }

    blocked = admin_client.post(reverse("production-plan-list-create"), payload, format="json")
    payload["override_business_closure"] = True
    overridden = admin_client.post(reverse("production-plan-list-create"), payload, format="json")

    assert blocked.status_code == 400
    assert "marked closed" in str(blocked.data)
    assert overridden.status_code == 201
    assert ProductionPlan.objects.count() == 1


@pytest.mark.django_db
def test_overview_reports_holidays_closures_and_preparation_risk(admin_client: APIClient) -> None:
    today = timezone.localdate()
    Holiday.objects.create(
        code="TEST-HOLIDAY",
        name_zh="测试节日",
        name_en="Test Holiday",
        holiday_date=today + timedelta(days=2),
    )
    event = BusinessEvent.objects.create(
        name="At risk event",
        event_type=BusinessEvent.EventType.KOL_COLLABORATION,
        start_date=today + timedelta(days=2),
        end_date=today + timedelta(days=2),
        preparation_days=10,
    )
    EventChecklistItem.objects.create(
        event=event,
        category=EventChecklistItem.Category.MARKETING,
        title_zh="测试",
        title_en="Test",
    )
    BusinessClosure.objects.create(
        name="Test closure",
        closure_type=BusinessClosure.ClosureType.REST_DAY,
        start_date=today + timedelta(days=3),
        end_date=today + timedelta(days=3),
    )

    response = admin_client.get(reverse("event-overview"), {"year": today.year})

    assert response.status_code == 200
    assert response.data["kpis"] == {
        "upcoming_count": 1,
        "next_30_days_count": 1,
        "in_preparation_count": 1,
        "needs_attention_count": 1,
    }
    assert response.data["events"][0]["status"] == "PREPARATION_RISK"
    assert len(response.data["holidays"]) == 1
    assert len(response.data["closures"]) == 1


@pytest.mark.django_db
def test_seed_demo_events_is_idempotent() -> None:
    call_command("seed_demo_products")
    call_command("seed_demo_events")
    counts = (
        Holiday.objects.count(),
        BusinessEvent.objects.count(),
        BusinessClosure.objects.count(),
        EventChecklistItem.objects.count(),
    )

    call_command("seed_demo_events")

    assert counts == (
        Holiday.objects.count(),
        BusinessEvent.objects.count(),
        BusinessClosure.objects.count(),
        EventChecklistItem.objects.count(),
    )
    assert counts[:3] == (11, 5, 2)
