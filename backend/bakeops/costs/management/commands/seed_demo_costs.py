from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from bakeops.costs.models import CostMonth, MonthlyCost
from bakeops.costs.services import ensure_cost_month, next_month

COST_START = date(2025, 9, 1)
COST_END = date(2026, 8, 1)
PENNY = Decimal("0.01")

# Baselines follow the existing June and July 2026 demo costs. Variable costs
# use deterministic seasonal factors so repeated seeds produce the same year.
BASE_AMOUNTS = {
    "Ingredients and Materials": Decimal("800.00"),
    "Accounting": Decimal("2000.00"),
    "Cleaning": Decimal("200.00"),
    "Insurance": Decimal("100.00"),
    "Shop Rent": Decimal("3000.00"),
    "Electricity": Decimal("500.00"),
    "Gas": Decimal("350.00"),
    "Water": Decimal("400.00"),
    "Utilities": Decimal("250.00"),
    "Waste Disposal": Decimal("400.00"),
}

MONTH_FACTORS = {
    "Ingredients and Materials": (
        "0.96",
        "1.00",
        "1.08",
        "1.25",
        "0.92",
        "0.94",
        "0.97",
        "1.00",
        "1.03",
        "1.00",
        "1.05",
        "1.04",
    ),
    "Cleaning": ("1.00", "1.00", "1.05", "1.15", "1.00", "1.00", "1.00", "1.02", "1.02", "1.00", "1.05", "1.05"),
    "Electricity": ("0.95", "1.00", "1.08", "1.18", "1.20", "1.14", "1.05", "0.98", "0.95", "1.00", "1.08", "1.10"),
    "Gas": ("0.80", "1.00", "1.25", "1.55", "1.65", "1.55", "1.30", "1.05", "0.80", "0.65", "0.58", "0.60"),
    "Water": ("0.96", "0.98", "1.00", "1.08", "1.00", "0.98", "0.98", "1.00", "1.02", "1.05", "1.10", "1.10"),
    "Utilities": ("0.96", "1.00", "1.08", "1.18", "1.20", "1.15", "1.08", "1.00", "0.96", "0.95", "1.00", "1.02"),
    "Waste Disposal": ("1.00", "1.00", "1.05", "1.15", "1.00", "1.00", "1.00", "1.02", "1.02", "1.00", "1.05", "1.05"),
}


def demo_amount(name_en: str, month_index: int) -> Decimal | None:
    baseline = BASE_AMOUNTS.get(name_en)
    if baseline is None:
        return None
    factors = MONTH_FACTORS.get(name_en)
    factor = Decimal(factors[month_index]) if factors else Decimal("1.00")
    return (baseline * factor).quantize(PENNY, rounding=ROUND_HALF_UP)


class Command(BaseCommand):
    help = "Seed twelve months of deterministic demo operating costs from September 2025 to August 2026."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        month = COST_START
        month_index = 0
        updated = 0
        preserved = 0

        while month <= COST_END:
            month_existed = CostMonth.objects.filter(month=month).exists()
            ensure_cost_month(month)
            costs = MonthlyCost.objects.filter(
                cost_month=month,
                cost_item__is_active=True,
            ).select_related("cost_item")

            for cost in costs:
                amount = demo_amount(cost.name_en, month_index)
                if amount is None:
                    continue
                if month_existed and cost.amount > 0:
                    preserved += 1
                    continue
                cost.amount = amount
                if not cost.notes:
                    cost.notes = "Demo operating cost"
                cost.save(update_fields=("amount", "notes", "cost_month", "updated_at"))
                updated += 1

            month = next_month(month)
            month_index += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded costs for {COST_START:%Y-%m} to {COST_END:%Y-%m}: "
                f"{updated} rows updated, {preserved} existing non-zero rows preserved."
            )
        )
