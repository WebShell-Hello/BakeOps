from collections import defaultdict
from datetime import date, datetime, time
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from bakeops.inventory.management.commands.seed_demo_inventory_receipts import (
    VALUE_QUANTUM,
    ensure_supplier_terms,
    normalize_price_per_display_unit,
)
from bakeops.inventory.management.commands.seed_demo_production_history import (
    HISTORY_START,
    allocate_quantity,
)
from bakeops.inventory.models import InventoryItem, InventoryReceipt, ProductionPlan
from bakeops.inventory.services import apply_inventory_receipt, build_inventory_snapshot, display_unit_for
from bakeops.products.costing import current_product_unit_cost
from bakeops.products.models import Ingredient
from bakeops.sales.management.commands.seed_demo_sales import (
    DISCOUNT_RATES,
    ORDER_SIZES,
    PENNY,
    PRICE_BY_PRODUCT,
    SALES_START,
    TIME_SLOTS,
    daily_sales_quantities,
    volume_discount_boost,
)
from bakeops.sales.models import SalesOrder, SalesOrderLine
from bakeops.suppliers.models import SupplierIngredient

PRODUCTION_START = date(2026, 8, 16)
PRODUCTION_END = date(2026, 8, 30)
SALES_START_DATE = date(2026, 8, 15)
SALES_END_DATE = date(2026, 8, 30)
SALES_REFERENCE_PREFIX = "DEMO-SALE-"
AUTO_RECEIPT_PREFIX = "DEMO-AUTO-GRN-"
DISPLAY_QUANTUM = Decimal("0.001")


class Command(BaseCommand):
    help = "Seed late-August demo actual production, sales, and automatic inventory restocking."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        call_command("seed_demo_products")
        call_command("seed_leadership_products")
        call_command("seed_demo_suppliers")
        call_command("seed_demo_production_history")
        call_command("seed_demo_august_15")

        updated_actuals = update_actual_production()
        deleted_orders = delete_demo_sales()
        order_count, line_count, sold_quantity = create_sales()
        deleted_receipts = rollback_auto_receipts()
        receipt_count = create_auto_restock_receipts()

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded late-August demo data: "
                f"{updated_actuals} production actuals updated, "
                f"{deleted_orders} existing demo sales records replaced, "
                f"{order_count} orders, {line_count} sales lines, {sold_quantity} units sold, "
                f"{deleted_receipts} previous auto receipts replaced, {receipt_count} auto restock receipts created."
            )
        )


def update_actual_production() -> int:
    updated = 0
    current = PRODUCTION_START
    while current <= PRODUCTION_END:
        plans = list(
            ProductionPlan.objects.filter(planned_date=current)
            .exclude(status=ProductionPlan.Status.CANCELLED)
            .select_related("product")
            .order_by("product__code")
        )
        if not plans:
            current = date.fromordinal(current.toordinal() + 1)
            continue

        day_index = (current - HISTORY_START).days
        planned_total = sum(plan.quantity for plan in plans)
        completion_rate = Decimal(90 + ((day_index * 7 + current.day) % 19)) / Decimal("100")
        if current.weekday() in {4, 5, 6}:
            completion_rate += Decimal("0.03")
        actual_total = min(500, max(220, round(Decimal(planned_total) * completion_rate)))
        actual_quantities = allocate_quantity(actual_total, len(plans), day_index + 29)

        for plan, actual_quantity in zip(plans, actual_quantities, strict=True):
            plan.actual_quantity = actual_quantity
            plan.status = ProductionPlan.Status.CONFIRMED
            plan.notes = "8月16日至8月30日演示实际制作数据 · 基于近期生产节奏生成"
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
            updated += 1
        current = date.fromordinal(current.toordinal() + 1)
    return updated


def delete_demo_sales() -> int:
    deleted = 0
    current = SALES_START_DATE
    while current <= SALES_END_DATE:
        count, _ = SalesOrder.objects.filter(
            reference__startswith=f"{SALES_REFERENCE_PREFIX}{current:%Y%m%d}-"
        ).delete()
        deleted += count
        current = date.fromordinal(current.toordinal() + 1)
    return deleted


def create_sales() -> tuple[int, int, int]:
    timezone_info = timezone.get_current_timezone()
    order_count = 0
    line_count = 0
    total_quantity = 0
    current = SALES_START_DATE
    while current <= SALES_END_DATE:
        plans = list(
            ProductionPlan.objects.filter(
                planned_date=current,
                actual_quantity__isnull=False,
            )
            .exclude(status=ProductionPlan.Status.CANCELLED)
            .select_related("product")
            .order_by("product__code")
        )
        day_index = (current - SALES_START).days
        sales_quantities = daily_sales_quantities(plans, day_index, current)
        daily_sales_quantity = sum(sales_quantities)
        remaining = []
        for plan, target in zip(plans, sales_quantities, strict=True):
            if target:
                remaining.append({"plan": plan, "quantity": target})
        cursor = day_index % max(len(remaining), 1)
        daily_order_index = 0

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
                reference=f"{SALES_REFERENCE_PREFIX}{current:%Y%m%d}-{daily_order_index + 1:04d}",
                sold_at=timezone.make_aware(datetime.combine(current, sold_time), timezone_info),
            )
            order_count += 1
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
                line_count += 1
                total_quantity += quantity
            daily_order_index += 1
        current = date.fromordinal(current.toordinal() + 1)
    return order_count, line_count, total_quantity


def rollback_auto_receipts() -> int:
    receipts = list(
        InventoryReceipt.objects.filter(reference__startswith=AUTO_RECEIPT_PREFIX).select_related("ingredient")
    )
    for receipt in receipts:
        inventory = InventoryItem.objects.filter(ingredient=receipt.ingredient).first()
        if inventory is None:
            continue
        receipt_value = (receipt.quantity * (receipt.unit_price or Decimal("0"))).quantize(
            VALUE_QUANTUM,
            rounding=ROUND_HALF_UP,
        )
        inventory.quantity = max(Decimal("0"), inventory.quantity - receipt.base_quantity)
        if inventory.inventory_value is not None:
            inventory.inventory_value = max(Decimal("0"), inventory.inventory_value - receipt_value)
        inventory.save(update_fields=("quantity", "inventory_value", "updated_at"))
    deleted, _ = InventoryReceipt.objects.filter(reference__startswith=AUTO_RECEIPT_PREFIX).delete()
    return deleted


def create_auto_restock_receipts() -> int:
    ingredients = list(Ingredient.objects.filter(is_active=True).order_by("name"))
    terms, _ = ensure_supplier_terms(ingredients)
    snapshot = build_inventory_snapshot()
    created = 0
    for item in snapshot["items"]:
        recommended_quantity = item.get("recommended_order_quantity")
        if item["status"] not in {"EMERGENCY", "PURCHASE_REQUIRED", "WATCH"} or recommended_quantity is None:
            continue
        ingredient = Ingredient.objects.get(id=item["ingredient_id"])
        term = terms.get(ingredient.id)
        if term is None:
            continue
        created += create_auto_receipt(ingredient, term, Decimal(recommended_quantity), created)
    return created


def create_auto_receipt(
    ingredient: Ingredient,
    term: SupplierIngredient,
    display_quantity: Decimal,
    index: int,
) -> int:
    display_unit = display_unit_for(ingredient.base_unit)
    display_quantity = display_quantity.quantize(DISPLAY_QUANTUM, rounding=ROUND_HALF_UP)
    if display_quantity <= 0:
        return 0
    unit_price = normalize_price_per_display_unit(term, display_unit).quantize(
        Decimal("0.0001"),
        rounding=ROUND_HALF_UP,
    )
    base_quantity = display_quantity if display_unit == ingredient.base_unit else display_quantity * Decimal("1000")
    purchase_value = (display_quantity * unit_price).quantize(VALUE_QUANTUM, rounding=ROUND_HALF_UP)
    inventory, _ = InventoryItem.objects.select_for_update().get_or_create(ingredient=ingredient)
    apply_inventory_receipt(inventory, base_quantity, purchase_value)
    reference = f"{AUTO_RECEIPT_PREFIX}{timezone.localdate():%Y%m%d}-{index + 1:04d}-{str(ingredient.id)[:8].upper()}"
    InventoryReceipt.objects.create(
        reference=reference,
        ingredient=ingredient,
        supplier=term.supplier,
        quantity=display_quantity,
        unit=display_unit,
        base_quantity=base_quantity,
        base_unit=ingredient.base_unit,
        unit_price=unit_price,
        currency="GBP",
        price_unit=display_unit,
        notes="按补货周期、最小订货量和14天生产需求自动补货",
        received_at=timezone.make_aware(datetime.combine(timezone.localdate(), time(9, 30))),
    )
    return 1
