from collections import defaultdict
from datetime import date, datetime, time
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from bakeops.inventory.models import ProductionPlan
from bakeops.sales.models import SalesOrder, SalesOrderLine

SALES_START = date(2025, 8, 15)
SALES_END = date(2026, 8, 14)
PRICE_BY_PRODUCT = {
    "凉皮": Decimal("6.50"),
    "奶黄包": Decimal("2.80"),
    "桂花桂圆莲子八宝粥": Decimal("4.50"),
    "红糖姜奶鸡蛋羹": Decimal("3.80"),
    "胡辣汤": Decimal("5.50"),
    "蒸馒头": Decimal("1.50"),
    "蔓越莓山核桃面包": Decimal("4.80"),
}
SELL_THROUGH_RATES = (78, 82, 86, 90, 94, 96)
DISCOUNT_RATES = (
    Decimal("0"),
    Decimal("0"),
    Decimal("0"),
    Decimal("0.05"),
    Decimal("0.10"),
    Decimal("0.15"),
    Decimal("0.20"),
)
ORDER_SIZES = (1, 2, 2, 3, 3, 4)
TIME_SLOTS = (
    time(8, 0),
    time(8, 30),
    time(9, 0),
    time(9, 30),
    time(10, 30),
    time(12, 0),
    time(12, 30),
    time(13, 0),
    time(14, 0),
    time(16, 0),
    time(17, 0),
)
PENNY = Decimal("0.01")


class Command(BaseCommand):
    help = "Generate one year of deterministic demo sales without exceeding actual production."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not ProductionPlan.objects.filter(
            planned_date__range=(SALES_START, SALES_END),
            actual_quantity__isnull=False,
        ).exists():
            call_command("seed_demo_production_history")

        SalesOrder.objects.filter(reference__startswith="DEMO-SALE-").delete()
        plans_by_date: dict[date, list[ProductionPlan]] = defaultdict(list)
        plans = (
            ProductionPlan.objects.filter(
                planned_date__range=(SALES_START, SALES_END),
                actual_quantity__isnull=False,
            )
            .exclude(status=ProductionPlan.Status.CANCELLED)
            .select_related("product")
            .order_by("planned_date", "product__code")
        )
        for plan in plans:
            plans_by_date[plan.planned_date].append(plan)

        orders: list[SalesOrder] = []
        lines: list[SalesOrderLine] = []
        timezone_info = timezone.get_current_timezone()
        total_quantity = 0

        for day_index, (sales_date, daily_plans) in enumerate(sorted(plans_by_date.items())):
            remaining = []
            for product_index, plan in enumerate(daily_plans):
                actual = plan.actual_quantity or 0
                rate = SELL_THROUGH_RATES[(day_index + product_index * 2) % len(SELL_THROUGH_RATES)]
                target = min(actual, int(actual * rate / 100))
                if target:
                    remaining.append({"plan": plan, "quantity": target})
            cursor = day_index % max(len(remaining), 1)
            daily_order_index = 0

            while any(item["quantity"] > 0 for item in remaining):
                capacity = ORDER_SIZES[(day_index + daily_order_index) % len(ORDER_SIZES)]
                basket: dict[Any, dict[str, Any]] = {}
                for _ in range(capacity):
                    available = [item for item in remaining if item["quantity"] > 0]
                    if not available:
                        break
                    selected = available[cursor % len(available)]
                    cursor += 1
                    selected["quantity"] -= 1
                    product = selected["plan"].product
                    basket.setdefault(product.id, {"product": product, "quantity": 0})["quantity"] += 1

                sold_time = TIME_SLOTS[(day_index * 3 + daily_order_index) % len(TIME_SLOTS)]
                order = SalesOrder(
                    reference=f"DEMO-SALE-{sales_date:%Y%m%d}-{daily_order_index + 1:04d}",
                    sold_at=timezone.make_aware(datetime.combine(sales_date, sold_time), timezone_info),
                )
                orders.append(order)
                for product_index, basket_item in enumerate(basket.values()):
                    product = basket_item["product"]
                    quantity = basket_item["quantity"]
                    unit_price = PRICE_BY_PRODUCT.get(product.name_zh, Decimal("3.50"))
                    standard_sales = (unit_price * quantity).quantize(PENNY)
                    discount_rate = DISCOUNT_RATES[
                        (day_index + daily_order_index * 2 + product_index) % len(DISCOUNT_RATES)
                    ]
                    discount = (standard_sales * discount_rate).quantize(PENNY, rounding=ROUND_HALF_UP)
                    paid = standard_sales - discount
                    refund = Decimal("0.00")
                    if (day_index + daily_order_index * 7 + product_index) % 53 == 0:
                        refund = min(paid, (unit_price * Decimal("0.50")).quantize(PENNY))
                    lines.append(
                        SalesOrderLine(
                            order=order,
                            product=product,
                            product_name_zh=product.name_zh,
                            product_name_en=product.name_en,
                            quantity=quantity,
                            standard_unit_price=unit_price,
                            standard_sales_amount=standard_sales,
                            discount_amount=discount,
                            paid_amount=paid,
                            refund_amount=refund,
                        )
                    )
                    total_quantity += quantity
                daily_order_index += 1

        SalesOrder.objects.bulk_create(orders, batch_size=1000)
        SalesOrderLine.objects.bulk_create(lines, batch_size=1000)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded sales for {SALES_START.isoformat()} to {SALES_END.isoformat()}: "
                f"{len(orders)} orders, {len(lines)} lines, {total_quantity} units sold."
            )
        )
