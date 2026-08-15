from collections import defaultdict
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from bakeops.inventory.management.commands.seed_demo_production_history import (
    HISTORY_START,
    allocate_quantity,
    daily_planned_quantity,
)
from bakeops.inventory.models import ProductionPlan
from bakeops.products.costing import current_product_unit_cost
from bakeops.sales.management.commands.seed_demo_sales import (
    DISCOUNT_RATES,
    ORDER_SIZES,
    PENNY,
    PRICE_BY_PRODUCT,
    TIME_SLOTS,
    daily_sales_quantities,
    volume_discount_boost,
)
from bakeops.sales.models import SalesOrder, SalesOrderLine

TARGET_DATE = date(2026, 8, 15)
TARGET_REFERENCE_PREFIX = f"DEMO-SALE-{TARGET_DATE:%Y%m%d}-"


class Command(BaseCommand):
    help = "Seed deterministic actual production and sales data for 2026-08-15."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not ProductionPlan.objects.filter(planned_date=TARGET_DATE).exists():
            call_command("seed_demo_production_history")

        plans = list(
            ProductionPlan.objects.filter(planned_date=TARGET_DATE)
            .exclude(status=ProductionPlan.Status.CANCELLED)
            .select_related("product")
            .order_by("product__code")
        )
        if not plans:
            self.stdout.write(self.style.WARNING("No production plans were available for 2026-08-15."))
            return

        day_index = (TARGET_DATE - HISTORY_START).days
        planned_total = sum(plan.quantity for plan in plans) or daily_planned_quantity(day_index, TARGET_DATE, None)
        actual_total = min(500, max(260, round(planned_total * Decimal("0.97"))))
        actual_quantities = allocate_quantity(actual_total, len(plans), day_index + 19)

        updated_plans = 0
        for plan, actual_quantity in zip(plans, actual_quantities, strict=True):
            plan.actual_quantity = actual_quantity
            plan.status = ProductionPlan.Status.CONFIRMED
            plan.notes = "8月15日远程演示实际制作数据 · 基于近期历史节奏生成"
            unit_cost = current_product_unit_cost(plan.product)
            if unit_cost is not None:
                plan.actual_unit_material_cost = unit_cost
                plan.actual_cost_captured_at = timezone.now()
            else:
                plan.actual_unit_material_cost = None
                plan.actual_cost_captured_at = None
            plan.save(
                update_fields=(
                    "actual_quantity",
                    "status",
                    "notes",
                    "actual_unit_material_cost",
                    "actual_cost_captured_at",
                    "updated_at",
                )
            )
            updated_plans += 1

        deleted_orders, _ = SalesOrder.objects.filter(reference__startswith=TARGET_REFERENCE_PREFIX).delete()
        sales_quantity = self._create_sales(plans, day_index)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {TARGET_DATE.isoformat()}: {updated_plans} production actuals updated, "
                f"{deleted_orders} existing demo sales orders replaced, {sales_quantity} units sold."
            )
        )

    def _create_sales(self, plans: list[ProductionPlan], day_index: int) -> int:
        sales_quantities = daily_sales_quantities(plans, day_index, TARGET_DATE)
        daily_sales_quantity = sum(sales_quantities)
        remaining = []
        for plan, target in zip(plans, sales_quantities, strict=True):
            if target:
                remaining.append({"plan": plan, "quantity": target})

        cursor = day_index % max(len(remaining), 1)
        daily_order_index = 0
        timezone_info = timezone.get_current_timezone()
        total_quantity = 0

        while any(item["quantity"] > 0 for item in remaining):
            capacity = ORDER_SIZES[(day_index + daily_order_index) % len(ORDER_SIZES)]
            basket: dict[Any, dict[str, Any]] = defaultdict(lambda: {"product": None, "quantity": 0})
            for _ in range(capacity):
                available = [item for item in remaining if item["quantity"] > 0]
                if not available:
                    break
                selected = available[cursor % len(available)]
                cursor += 1
                selected["quantity"] -= 1
                product = selected["plan"].product
                basket[product.id]["product"] = product
                basket[product.id]["quantity"] += 1

            sold_time = TIME_SLOTS[(day_index * 3 + daily_order_index) % len(TIME_SLOTS)]
            order = SalesOrder.objects.create(
                reference=f"{TARGET_REFERENCE_PREFIX}{daily_order_index + 1:04d}",
                sold_at=timezone.make_aware(datetime.combine(TARGET_DATE, sold_time), timezone_info),
            )
            for product_index, basket_item in enumerate(basket.values()):
                product = basket_item["product"]
                quantity = basket_item["quantity"]
                unit_price = PRICE_BY_PRODUCT.get(product.name_zh, Decimal("4.00"))
                standard_sales = (unit_price * quantity).quantize(PENNY)
                discount_rate = DISCOUNT_RATES[
                    (day_index + daily_order_index * 2 + product_index) % len(DISCOUNT_RATES)
                ]
                discount_rate = min(Decimal("0.25"), discount_rate + volume_discount_boost(daily_sales_quantity))
                discount = (standard_sales * discount_rate).quantize(PENNY, rounding=ROUND_HALF_UP)
                if quantity > 1 and (day_index * 5 + daily_order_index + product_index) % 47 == 0:
                    discount = min(standard_sales, discount + unit_price)
                paid = standard_sales - discount
                refund = Decimal("0.00")
                if (day_index + daily_order_index * 7 + product_index) % 53 == 0:
                    refund = min(paid, (unit_price * Decimal("0.50")).quantize(PENNY))
                SalesOrderLine.objects.create(
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
                total_quantity += quantity
            daily_order_index += 1

        return total_quantity
