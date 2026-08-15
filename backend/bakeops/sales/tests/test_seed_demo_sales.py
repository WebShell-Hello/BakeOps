from datetime import date

import pytest
from django.core.management import call_command
from django.db.models import Sum
from django.db.models.functions import TruncDate

from bakeops.inventory.models import ProductionPlan
from bakeops.products.models import Product
from bakeops.sales.management.commands.seed_demo_sales import STABLE_SALES_START
from bakeops.sales.models import SalesOrder, SalesOrderLine


@pytest.mark.django_db
def test_seed_demo_sales_never_exceeds_actual_production_and_is_idempotent() -> None:
    call_command("seed_demo_products")
    product = Product.objects.get(name_zh="奶黄包")
    ProductionPlan.objects.create(
        reference="SALES-SEED-PLAN",
        product=product,
        planned_date=date(2026, 8, 10),
        quantity=100,
        actual_quantity=90,
        status=ProductionPlan.Status.CONFIRMED,
    )

    call_command("seed_demo_sales")
    first_order_count = SalesOrder.objects.count()
    first_line_count = SalesOrderLine.objects.count()
    sold = SalesOrderLine.objects.aggregate(total=Sum("quantity"))["total"] or 0

    call_command("seed_demo_sales")

    assert sold > 0
    assert SalesOrder.objects.count() == first_order_count
    assert SalesOrderLine.objects.count() == first_line_count
    assert SalesOrderLine.objects.filter(standard_unit_price__lt="1.00").count() == 0
    assert SalesOrderLine.objects.filter(discount_amount__gt=0).exists()

    recent_daily_sales = (
        SalesOrderLine.objects.filter(order__sold_at__date__gte=STABLE_SALES_START)
        .annotate(sales_date=TruncDate("order__sold_at"))
        .values("sales_date")
        .annotate(quantity=Sum("quantity"))
        .order_by("sales_date")
    )
    assert recent_daily_sales
    for row in recent_daily_sales:
        assert 220 <= row["quantity"] <= 450

    actual_by_product_date = {
        (plan.product_id, plan.planned_date): plan.actual_quantity or 0
        for plan in ProductionPlan.objects.filter(
            planned_date__range=(STABLE_SALES_START, date(2026, 8, 14)),
            actual_quantity__isnull=False,
        )
    }
    sold_by_product_date = (
        SalesOrderLine.objects.filter(order__sold_at__date__gte=STABLE_SALES_START)
        .annotate(sales_date=TruncDate("order__sold_at"))
        .values("product_id", "sales_date")
        .annotate(quantity=Sum("quantity"))
    )
    for row in sold_by_product_date:
        assert row["quantity"] <= actual_by_product_date[(row["product_id"], row["sales_date"])]

    manual_plan_sales = SalesOrderLine.objects.filter(
        product=product,
        order__sold_at__date=date(2026, 8, 10),
    ).aggregate(total=Sum("quantity"))["total"] or 0
    assert manual_plan_sales <= 90
