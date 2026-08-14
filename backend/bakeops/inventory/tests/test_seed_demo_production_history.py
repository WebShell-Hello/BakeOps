from datetime import date

import pytest
from django.core.management import call_command

from bakeops.inventory.management.commands.seed_demo_production_history import (
    HISTORY_END,
    HISTORY_START,
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
    assert history.filter(quantity__lt=100).count() == 0
    assert history.filter(quantity__gt=500).count() == 0
    assert history.filter(actual_quantity__lt=100).count() == 0
    assert history.filter(actual_quantity__gt=500).count() == 0
    assert history.order_by("planned_date").values_list("planned_date", flat=True).first() == HISTORY_START
    assert history.order_by("-planned_date").values_list("planned_date", flat=True).first() == HISTORY_END


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
def test_discontinued_products_stop_appearing_after_their_demo_end_dates() -> None:
    call_command("seed_demo_production_history")

    liangpi = Product.objects.get(name_zh="凉皮")
    hu_la_tang = Product.objects.get(name_zh="胡辣汤")
    assert ProductionPlan.objects.filter(product=liangpi, planned_date__lte=date(2026, 3, 31)).exists()
    assert not ProductionPlan.objects.filter(product=liangpi, planned_date__gt=date(2026, 3, 31)).exists()
    assert ProductionPlan.objects.filter(product=hu_la_tang, planned_date__lte=date(2026, 5, 31)).exists()
    assert not ProductionPlan.objects.filter(product=hu_la_tang, planned_date__gt=date(2026, 5, 31)).exists()
