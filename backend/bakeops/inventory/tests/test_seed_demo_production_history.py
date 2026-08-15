from datetime import date, timedelta

import pytest
from django.core.management import call_command
from django.db.models import Count, Sum

from bakeops.inventory.management.commands.seed_demo_production_history import (
    HISTORY_END,
    HISTORY_START,
    LIMITED_PRODUCT_CODES,
    PLAN_END,
    STABLE_TRADING_START,
)
from bakeops.inventory.models import ProductionPlan
from bakeops.products.models import Product


@pytest.mark.django_db
def test_seed_demo_production_history_creates_complete_year_and_is_idempotent() -> None:
    call_command("seed_demo_production_history")

    history = ProductionPlan.objects.filter(
        planned_date__range=(HISTORY_START, HISTORY_END),
        reference__startswith="HIST-",
    )
    initial_count = history.count()

    call_command("seed_demo_production_history")

    assert initial_count > 1500
    assert history.count() == initial_count
    assert history.filter(actual_quantity__isnull=True).count() == 0
    assert history.filter(quantity__lt=1).count() == 0
    assert history.filter(actual_quantity__lt=1).count() == 0
    assert history.order_by("planned_date").values_list("planned_date", flat=True).first() == HISTORY_START
    assert history.order_by("-planned_date").values_list("planned_date", flat=True).first() == HISTORY_END

    future = ProductionPlan.objects.filter(
        planned_date__gt=HISTORY_END,
        planned_date__lte=PLAN_END,
        reference__startswith="HIST-",
    )
    assert future.exists()
    assert not future.exclude(actual_quantity__isnull=True).exists()
    assert not future.exclude(status=ProductionPlan.Status.PLANNED).exists()

    historical_daily_totals = history.values("planned_date").annotate(
        planned_total=Sum("quantity"),
        actual_total=Sum("actual_quantity"),
    )
    for row in historical_daily_totals:
        assert 100 <= row["planned_total"] <= 500
        if row["planned_date"] < HISTORY_END:
            assert 88 <= row["actual_total"] <= 500

    stable_daily_totals = ProductionPlan.objects.filter(
        planned_date__range=(STABLE_TRADING_START, PLAN_END),
        reference__startswith="HIST-",
    ).values("planned_date").annotate(
        planned_total=Sum("quantity"),
        actual_total=Sum("actual_quantity"),
    )
    for row in stable_daily_totals:
        assert 300 <= row["planned_total"] <= 500
        if row["planned_date"] <= HISTORY_END:
            assert 220 <= row["actual_total"] <= 500


@pytest.mark.django_db
def test_seed_demo_production_history_rotates_daily_and_limited_products() -> None:
    call_command("seed_demo_production_history")

    plans = ProductionPlan.objects.filter(
        planned_date__range=(HISTORY_START, PLAN_END),
        reference__startswith="HIST-",
    )
    limited_dates = set(
        plans.filter(product__code__in=LIMITED_PRODUCT_CODES)
        .values_list("planned_date", flat=True)
        .distinct()
    )
    daily_counts = plans.values("planned_date").annotate(product_count=Count("id"))

    assert limited_dates
    expected_demo_activity_dates: set[date] = set()
    current = HISTORY_START
    while current <= PLAN_END:
        if current.day <= 7 and current.weekday() in {5, 6}:
            expected_demo_activity_dates.add(current)
        current += timedelta(days=1)
    assert limited_dates == expected_demo_activity_dates
    for row in daily_counts:
        if row["planned_date"] in limited_dates:
            assert 15 <= row["product_count"] <= 25
        else:
            assert 15 <= row["product_count"] <= 20


@pytest.mark.django_db
def test_seed_demo_production_history_preserves_existing_plan() -> None:
    call_command("seed_demo_products")
    product = Product.objects.filter(recipes__is_active=True).order_by("code").first()
    assert product is not None
    existing = ProductionPlan.objects.create(
        reference="USER-HISTORICAL-PLAN",
        product=product,
        planned_date=date(2026, 6, 10),
        quantity=999,
        actual_quantity=888,
        status=ProductionPlan.Status.CONFIRMED,
        notes="User-entered historical data",
    )

    call_command("seed_demo_production_history")

    existing.refresh_from_db()
    assert existing.quantity == 999
    assert existing.actual_quantity == 888
    assert existing.notes == "User-entered historical data"


@pytest.mark.django_db
def test_legacy_products_are_not_added_to_leadership_demo_plans() -> None:
    call_command("seed_demo_production_history")

    liangpi = Product.objects.get(name_zh="凉皮")
    hu_la_tang = Product.objects.get(name_zh="胡辣汤")
    assert not ProductionPlan.objects.filter(product=liangpi, reference__startswith="HIST-").exists()
    assert not ProductionPlan.objects.filter(product=hu_la_tang, reference__startswith="HIST-").exists()
