from datetime import date

import pytest
from django.core.management import call_command
from django.db.models import Sum

from bakeops.inventory.models import ProductionPlan
from bakeops.products.models import Product
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

    assert 0 < sold <= 90
    assert SalesOrder.objects.count() == first_order_count
    assert SalesOrderLine.objects.count() == first_line_count
    assert SalesOrderLine.objects.filter(standard_unit_price__lt="1.00").count() == 0
    assert SalesOrderLine.objects.filter(discount_amount__gt=0).exists()
