from datetime import date
from decimal import Decimal

import pytest
from django.core.management import call_command

from bakeops.costs.models import CostItem, CostMonth, MonthlyCost
from bakeops.costs.services import ensure_cost_month


@pytest.mark.django_db
def test_seed_demo_costs_creates_twelve_months_and_is_idempotent() -> None:
    call_command("seed_demo_costs")

    months = list(
        CostMonth.objects.filter(month__gte=date(2025, 9, 1), month__lte=date(2026, 8, 1))
        .order_by("month")
        .values_list("month", flat=True)
    )
    first_count = MonthlyCost.objects.filter(cost_month__in=months).count()

    call_command("seed_demo_costs")

    assert len(months) == 12
    assert first_count == MonthlyCost.objects.filter(cost_month__in=months).count()
    assert not MonthlyCost.objects.filter(name_en="Employee Wages").exists()


@pytest.mark.django_db
def test_seed_demo_costs_preserves_existing_non_zero_amounts() -> None:
    month = date(2026, 6, 1)
    ensure_cost_month(month)
    rent = CostItem.objects.get(name_en="Shop Rent")
    existing = MonthlyCost.objects.get(cost_month=month, cost_item=rent)
    existing.amount = Decimal("3456.00")
    existing.save()

    call_command("seed_demo_costs")

    existing.refresh_from_db()
    assert existing.amount == Decimal("3456.00")


@pytest.mark.django_db
def test_seed_demo_costs_applies_seasonal_variation() -> None:
    call_command("seed_demo_costs")

    gas = CostItem.objects.get(name_en="Gas")
    december = MonthlyCost.objects.get(cost_month=date(2025, 12, 1), cost_item=gas)
    july = MonthlyCost.objects.get(cost_month=date(2026, 7, 1), cost_item=gas)

    assert december.amount == Decimal("542.50")
    assert july.amount == Decimal("203.00")
    assert december.amount > july.amount
