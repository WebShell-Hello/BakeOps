from datetime import timedelta

import pytest
from django.core.management import call_command
from django.db.models import Sum
from django.utils import timezone

from bakeops.inventory.management.commands.seed_demo_inventory_receipts import build_daily_demand, build_recipe_map
from bakeops.inventory.models import InventoryReceipt, ProductionPlan

RECEIPT_PREFIX = "DEMO-HIST-GRN-"


@pytest.mark.django_db
def test_seed_demo_inventory_receipts_is_fortnightly_and_starts_before_production() -> None:
    call_command("seed_demo_products")
    call_command("seed_demo_suppliers")
    call_command("seed_demo_production_history")

    call_command("seed_demo_inventory_receipts")
    first_count = InventoryReceipt.objects.filter(reference__startswith=RECEIPT_PREFIX).count()
    assert first_count > 100

    for ingredient_id in InventoryReceipt.objects.filter(reference__startswith=RECEIPT_PREFIX).values_list(
        "ingredient_id", flat=True
    ).distinct():
        first_receipt = InventoryReceipt.objects.filter(
            reference__startswith=RECEIPT_PREFIX,
            ingredient_id=ingredient_id,
        ).order_by("received_at").first()
        first_plan = (
            ProductionPlan.objects.filter(
                product__recipes__sections__items__ingredient_id=ingredient_id,
                actual_quantity__gt=0,
            )
            .order_by("planned_date")
            .first()
        )
        assert first_receipt is not None
        assert first_plan is not None
        assert first_receipt.received_at.date() < first_plan.planned_date

        dates = list(
            InventoryReceipt.objects.filter(
                reference__startswith=RECEIPT_PREFIX,
                ingredient_id=ingredient_id,
            )
            .order_by("received_at")
            .values_list("received_at", flat=True)
        )
        assert all(
            (later.date() - earlier.date()).days >= 14
            and (later.date() - earlier.date()).days % 14 == 0
            for earlier, later in zip(dates, dates[1:])
        )

    assert not InventoryReceipt.objects.filter(
        reference__startswith=RECEIPT_PREFIX,
        unit_price__lte=0,
    ).exists()

    today = timezone.localdate()
    plans = list(
        ProductionPlan.objects.filter(planned_date__range=(today - timedelta(days=364), today))
        .exclude(status=ProductionPlan.Status.CANCELLED)
        .select_related("product")
    )
    actual_demand = build_daily_demand(plans, build_recipe_map(), today, actual_only=True)
    for ingredient_id, ingredient_days in actual_demand.items():
        consumed = sum(ingredient_days.values())
        purchased = (
            InventoryReceipt.objects.filter(reference__startswith=RECEIPT_PREFIX, ingredient_id=ingredient_id)
            .aggregate(total=Sum("base_quantity"))["total"]
            or 0
        )
        assert purchased >= consumed * 1.10

    call_command("seed_demo_inventory_receipts")
    assert InventoryReceipt.objects.filter(reference__startswith=RECEIPT_PREFIX).count() == first_count
