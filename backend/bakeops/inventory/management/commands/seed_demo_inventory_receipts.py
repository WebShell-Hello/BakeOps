from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from bakeops.inventory.models import InventoryItem, InventoryReceipt, ProductionPlan
from bakeops.inventory.services import convert_quantity, display_unit_for
from bakeops.products.models import Ingredient, Recipe, RecipeIngredient
from bakeops.suppliers.models import Supplier, SupplierIngredient

RECEIPT_PREFIX = "DEMO-HIST-GRN-"
RECEIPT_INTERVAL_DAYS = 14
RECEIPT_LOOKAHEAD_DAYS = RECEIPT_INTERVAL_DAYS - 1
WASTE_FACTOR = Decimal("1.10")
PRICE_FACTORS = (Decimal("0.98"), Decimal("1.01"), Decimal("1.03"), Decimal("0.99"), Decimal("1.02"))
DISPLAY_QUANTUM = Decimal("0.001")
VALUE_QUANTUM = Decimal("0.0001")


def product_demand_quantity(plan: ProductionPlan, today: date) -> int:
    """Use actual output for past days and the full plan for today/future days."""
    actual = plan.actual_quantity or 0
    if plan.planned_date < today:
        return actual
    if plan.planned_date == today:
        return max(plan.quantity, actual)
    return plan.quantity


def normalize_price_per_display_unit(term: SupplierIngredient, display_unit: str) -> Decimal:
    """Convert demo supplier prices such as tins or eggs into the inventory display unit."""
    if term.price_unit in {display_unit, "kg"}:
        return term.unit_price
    if term.price_unit in {"litre", "l", "L"} and display_unit in {"kg", "g"}:
        # Water-based bakery ingredients are close enough to 1 kg/litre for demo valuation.
        return term.unit_price
    assumed_display_quantity = {
        "tin": Decimal("0.400"),
        "each": Decimal("0.060"),
        "pcs": Decimal("0.060"),
    }.get(term.price_unit)
    if assumed_display_quantity is not None:
        return term.unit_price / assumed_display_quantity
    return term.unit_price


def minimum_display_quantity(term: SupplierIngredient, display_unit: str) -> Decimal:
    if term.minimum_order_unit == display_unit:
        return term.minimum_order_quantity
    assumed_display_quantity = {
        "tin": Decimal("0.400"),
        "each": Decimal("0.060"),
        "pcs": Decimal("0.060"),
    }.get(term.minimum_order_unit)
    if assumed_display_quantity is not None:
        return term.minimum_order_quantity * assumed_display_quantity
    return term.minimum_order_quantity


def build_recipe_map() -> dict[Any, Recipe]:
    recipes = Recipe.objects.filter(is_active=True).select_related("product").prefetch_related(
        "sections__items__ingredient"
    )
    return {recipe.product_id: recipe for recipe in recipes}


def ensure_supplier_terms(ingredients: list[Ingredient]) -> tuple[dict[Any, SupplierIngredient], list[str]]:
    terms: dict[Any, SupplierIngredient] = {}
    supplier_terms = SupplierIngredient.objects.filter(
            ingredient_id__in=[ingredient.id for ingredient in ingredients],
            is_active=True,
        ).select_related("ingredient", "supplier").order_by("ingredient_id", "-is_preferred", "unit_price")
    for term in supplier_terms:
        terms.setdefault(term.ingredient_id, term)
    missing = [ingredient for ingredient in ingredients if ingredient.id not in terms]
    if not missing:
        return terms, []

    fallback_supplier = Supplier.objects.order_by("code").first()
    if fallback_supplier is None:
        return terms, [ingredient.name for ingredient in missing]

    for index, ingredient in enumerate(missing):
        display_unit = display_unit_for(ingredient.base_unit)
        unit_price = Decimal("0.25") if display_unit in {"each", "pcs"} else Decimal("2.50")
        term, _ = SupplierIngredient.objects.update_or_create(
            supplier=fallback_supplier,
            ingredient=ingredient,
            defaults={
                "unit_price": unit_price,
                "currency": "GBP",
                "price_unit": display_unit,
                "minimum_order_quantity": Decimal("5"),
                "minimum_order_unit": display_unit,
                "lead_time_days": 3 + index % 5,
                "notes": "为补齐历史成本计算而生成的模拟供应条款",
                "is_active": True,
                "is_preferred": False,
            },
        )
        terms[ingredient.id] = term
    return terms, []


def build_daily_demand(
    plans: list[ProductionPlan],
    recipe_map: dict[Any, Recipe],
    today: date,
    actual_only: bool = False,
) -> dict[Any, dict[date, Decimal]]:
    demand: dict[Any, dict[date, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    for plan in plans:
        quantity = (plan.actual_quantity or 0) if actual_only and plan.planned_date <= today else 0
        if not actual_only:
            quantity = product_demand_quantity(plan, today)
        recipe = recipe_map.get(plan.product_id)
        if quantity <= 0 or recipe is None or recipe.yield_quantity <= 0:
            continue
        scale = Decimal(quantity) / Decimal(recipe.yield_quantity)
        for section in recipe.sections.all():
            for item in section.items.all():
                try:
                    base_quantity = convert_quantity(
                        item.weight * scale,
                        item.unit,
                        item.ingredient.base_unit,
                    )
                except ValueError:
                    continue
                demand[item.ingredient_id][plan.planned_date] += base_quantity
    return demand


def backfill_actual_cost_snapshots(
    plans: list[ProductionPlan],
    recipe_map: dict[Any, Recipe],
    receipts: list[InventoryReceipt],
    actual_daily_demand: dict[Any, dict[date, Decimal]],
    today: date,
) -> int:
    inventory_state: dict[Any, dict[str, Decimal]] = defaultdict(
        lambda: {"quantity": Decimal("0"), "value": Decimal("0")}
    )
    receipts_by_date: dict[date, list[InventoryReceipt]] = defaultdict(list)
    plans_by_date: dict[date, list[ProductionPlan]] = defaultdict(list)
    for receipt in receipts:
        receipts_by_date[receipt.received_at.date()].append(receipt)
    for plan in plans:
        if plan.planned_date <= today and (plan.actual_quantity or 0) > 0:
            plans_by_date[plan.planned_date].append(plan)

    updates: list[ProductionPlan] = []
    current = min(receipts_by_date) if receipts_by_date else today
    while current <= today:
        for receipt in receipts_by_date.get(current, []):
            state = inventory_state[receipt.ingredient_id]
            state["quantity"] += receipt.base_quantity
            if receipt.unit_price is not None:
                state["value"] += receipt.quantity * receipt.unit_price

        for plan in plans_by_date.get(current, []):
            if plan.actual_unit_material_cost is not None:
                continue
            recipe = recipe_map.get(plan.product_id)
            if recipe is None:
                continue
            recipe_cost = Decimal("0")
            complete = True
            for section in recipe.sections.all():
                for item in section.items.all():
                    state = inventory_state[item.ingredient_id]
                    if state["quantity"] <= 0:
                        complete = False
                        break
                    try:
                        base_quantity = convert_quantity(
                            item.weight,
                            item.unit,
                            item.ingredient.base_unit,
                        )
                    except ValueError:
                        complete = False
                        break
                    recipe_cost += base_quantity * state["value"] / state["quantity"]
                if not complete:
                    break
            if complete and recipe.yield_quantity > 0:
                plan.actual_unit_material_cost = (
                    recipe_cost / Decimal(recipe.yield_quantity)
                ).quantize(VALUE_QUANTUM, rounding=ROUND_HALF_UP)
                plan.actual_cost_captured_at = timezone.make_aware(
                    datetime.combine(current, time(18, 0))
                )
                updates.append(plan)

        for ingredient_id, ingredient_days in actual_daily_demand.items():
            consumed = ingredient_days.get(current, Decimal("0"))
            state = inventory_state[ingredient_id]
            if consumed <= 0 or state["quantity"] <= 0:
                continue
            consumed = min(consumed, state["quantity"])
            average_cost = state["value"] / state["quantity"]
            state["quantity"] -= consumed
            state["value"] = max(state["value"] - consumed * average_cost, Decimal("0"))
        current += timedelta(days=1)

    ProductionPlan.objects.bulk_update(
        updates,
        ("actual_unit_material_cost", "actual_cost_captured_at"),
    )
    return len(updates)


def simulate_remaining_inventory(
    ingredient: Ingredient,
    receipts: list[tuple[date, Decimal, Decimal]],
    daily_demand: dict[date, Decimal],
    start_date: date,
    end_date: date,
) -> tuple[Decimal, Decimal]:
    quantity = Decimal("0")
    value = Decimal("0")
    receipts_by_date: dict[date, list[tuple[Decimal, Decimal]]] = defaultdict(list)
    for received_date, base_quantity, purchase_value in receipts:
        receipts_by_date[received_date].append((base_quantity, purchase_value))

    current = start_date
    while current <= end_date:
        for base_quantity, purchase_value in receipts_by_date.get(current, []):
            quantity += base_quantity
            value += purchase_value
        consumed = daily_demand.get(current, Decimal("0"))
        if consumed > 0 and quantity > 0:
            consumed = min(consumed, quantity)
            average_cost = value / quantity if quantity else Decimal("0")
            quantity -= consumed
            value = max(value - consumed * average_cost, Decimal("0"))
        current += timedelta(days=1)
    return quantity.quantize(DISPLAY_QUANTUM), value.quantize(VALUE_QUANTUM)


class Command(BaseCommand):
    help = "Seed one year of fortnightly demo goods receipts based on production consumption."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        today = timezone.localdate()
        history_start = today - timedelta(days=364)
        demand_end = today + timedelta(days=RECEIPT_LOOKAHEAD_DAYS)
        # Refresh only deterministic demo records; user-entered plans and receipts are preserved.
        call_command("seed_demo_production_history")
        call_command("seed_demo_suppliers")

        plan_queryset = (
            ProductionPlan.objects.filter(planned_date__range=(history_start, demand_end))
            .exclude(status=ProductionPlan.Status.CANCELLED)
            .select_related("product")
        )
        plans = list(plan_queryset)
        recipe_map = build_recipe_map()
        daily_demand = build_daily_demand(plans, recipe_map, today)
        actual_daily_demand = build_daily_demand(plans, recipe_map, today, actual_only=True)
        ingredients = list(Ingredient.objects.filter(id__in=daily_demand.keys()).order_by("name"))
        terms, unpriced_ingredients = ensure_supplier_terms(ingredients)

        InventoryReceipt.objects.filter(reference__startswith=RECEIPT_PREFIX).delete()
        ProductionPlan.objects.filter(
            reference__startswith="HIST-",
            planned_date__range=(history_start, today),
        ).update(
            actual_unit_material_cost=None,
            actual_cost_captured_at=None,
        )
        created = 0
        skipped_ingredients: list[str] = []
        receipts_by_ingredient: dict[Any, list[tuple[date, Decimal, Decimal]]] = defaultdict(list)
        for ingredient_index, ingredient in enumerate(ingredients):
            ingredient_days = daily_demand[ingredient.id]
            active_days = sorted(day for day, quantity in ingredient_days.items() if quantity > 0)
            term = terms.get(ingredient.id)
            if not active_days or term is None:
                skipped_ingredients.append(ingredient.name)
                continue

            display_unit = display_unit_for(ingredient.base_unit)
            first_receipt_date = active_days[0] - timedelta(days=7)
            receipt_date = first_receipt_date
            receipt_index = 0
            while receipt_date <= today:
                window_end = receipt_date + timedelta(days=RECEIPT_INTERVAL_DAYS - 1)
                window_demand = sum(
                    (quantity for day, quantity in ingredient_days.items() if receipt_date <= day <= window_end),
                    start=Decimal("0"),
                )
                if window_demand > 0:
                    display_quantity = convert_quantity(
                        window_demand * WASTE_FACTOR,
                        ingredient.base_unit,
                        display_unit,
                    )
                    display_quantity = max(
                        display_quantity.quantize(DISPLAY_QUANTUM, rounding=ROUND_HALF_UP),
                        minimum_display_quantity(term, display_unit),
                    )
                    unit_price = (
                        normalize_price_per_display_unit(term, display_unit)
                        * PRICE_FACTORS[(ingredient_index + receipt_index) % len(PRICE_FACTORS)]
                    ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                    base_quantity = convert_quantity(display_quantity, display_unit, ingredient.base_unit)
                    purchase_value = (display_quantity * unit_price).quantize(VALUE_QUANTUM, rounding=ROUND_HALF_UP)
                    received_at = timezone.make_aware(datetime.combine(receipt_date, time(9, 0)))
                    reference = f"{RECEIPT_PREFIX}{receipt_date:%Y%m%d}-{str(ingredient.id)[:8].upper()}"
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
                        notes="按历史实际制作和当前/近期计划反推两周需求，含约10%处理损耗",
                        received_at=received_at,
                    )
                    receipts_by_ingredient[ingredient.id].append((receipt_date, base_quantity, purchase_value))
                    created += 1
                receipt_date += timedelta(days=RECEIPT_INTERVAL_DAYS)
                receipt_index += 1

            final_quantity, final_value = simulate_remaining_inventory(
                ingredient,
                receipts_by_ingredient[ingredient.id],
                actual_daily_demand[ingredient.id],
                min(first_receipt_date, history_start),
                today,
            )
            InventoryItem.objects.update_or_create(
                ingredient=ingredient,
                defaults={
                    "quantity": final_quantity,
                    "inventory_value": final_value,
                    "safety_buffer_days": 2,
                },
            )

        demo_receipts = list(
            InventoryReceipt.objects.filter(reference__startswith=RECEIPT_PREFIX).select_related("ingredient")
        )
        snapshots = backfill_actual_cost_snapshots(
            plans,
            recipe_map,
            demo_receipts,
            actual_daily_demand,
            today,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created} fortnightly receipts from {history_start.isoformat()} to {today.isoformat()} "
                f"with demand through {demand_end.isoformat()}; "
                f"{len(skipped_ingredients)} ingredients skipped and {snapshots} production cost snapshots backfilled."
            )
        )
        if unpriced_ingredients or skipped_ingredients:
            self.stdout.write(
                self.style.WARNING(
                    "Ingredients needing attention: "
                    + ", ".join(sorted(set(unpriced_ingredients + skipped_ingredients)))
                )
            )
