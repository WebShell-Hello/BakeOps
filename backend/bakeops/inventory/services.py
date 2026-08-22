from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from typing import Any

from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone

from bakeops.inventory.models import InventoryItem, InventoryReceipt, ProductionPlan
from bakeops.products.models import Ingredient, Recipe, RecipeIngredient, RecipeSection
from bakeops.suppliers.models import SupplierIngredient

FORECAST_DAYS = 14
DISPLAY_QUANTUM = Decimal("0.001")
VALUE_QUANTUM = Decimal("0.0001")
UNIT_DEFINITIONS: dict[str, tuple[str, Decimal]] = {
    "g": ("mass", Decimal("1")),
    "kg": ("mass", Decimal("1000")),
    "ml": ("volume", Decimal("1")),
    "l": ("volume", Decimal("1000")),
    "L": ("volume", Decimal("1000")),
}


def convert_quantity(value: Decimal, from_unit: str, to_unit: str) -> Decimal:
    if from_unit == to_unit:
        return value
    source = UNIT_DEFINITIONS.get(from_unit)
    target = UNIT_DEFINITIONS.get(to_unit)
    if source is None or target is None or source[0] != target[0]:
        raise ValueError(f"Cannot convert {from_unit} to {to_unit}")
    return value * source[1] / target[1]


def display_unit_for(base_unit: str) -> str:
    if base_unit == "g":
        return "kg"
    if base_unit == "ml":
        return "L"
    return base_unit


def calculate_purchase_value(
    quantity: Decimal,
    unit: str,
    unit_price: Decimal,
    price_unit: str,
) -> Decimal:
    priced_quantity = convert_quantity(quantity, unit, price_unit)
    return (priced_quantity * unit_price).quantize(VALUE_QUANTUM, rounding=ROUND_HALF_UP)


def apply_inventory_receipt(
    inventory: InventoryItem,
    base_quantity: Decimal,
    purchase_value: Decimal,
) -> None:
    if inventory.quantity == 0:
        inventory.inventory_value = purchase_value
    elif inventory.inventory_value is not None:
        inventory.inventory_value += purchase_value
    inventory.quantity += base_quantity
    inventory.full_clean()
    inventory.save(update_fields=("quantity", "inventory_value", "updated_at"))


class InventoryReceiptDeletionError(ValueError):
    pass


@transaction.atomic
def delete_inventory_receipts(receipt_ids: list[Any]) -> int:
    unique_ids = list(dict.fromkeys(receipt_ids))
    receipts = list(
        InventoryReceipt.objects.select_for_update()
        .select_related("ingredient")
        .filter(id__in=unique_ids)
    )
    if len(receipts) != len(unique_ids):
        raise InventoryReceiptDeletionError("One or more goods receipts no longer exist.")

    quantities: dict[Any, Decimal] = defaultdict(Decimal)
    purchase_values: dict[Any, Decimal] = defaultdict(Decimal)
    for receipt in receipts:
        quantities[receipt.ingredient_id] += receipt.base_quantity
        if receipt.unit_price is not None and receipt.price_unit:
            purchase_values[receipt.ingredient_id] += calculate_purchase_value(
                receipt.quantity,
                receipt.unit,
                receipt.unit_price,
                receipt.price_unit,
            )

    inventories = {
        inventory.ingredient_id: inventory
        for inventory in InventoryItem.objects.select_for_update().filter(
            ingredient_id__in=quantities
        )
    }
    if len(inventories) != len(quantities):
        raise InventoryReceiptDeletionError("Inventory data is missing for one or more goods receipts.")

    for ingredient_id, quantity in quantities.items():
        inventory = inventories[ingredient_id]
        new_quantity = inventory.quantity - quantity
        if new_quantity < 0:
            raise InventoryReceiptDeletionError(
                f"Deleting the selected receipts would make {inventory.ingredient.name} inventory negative."
            )

        new_inventory_value = inventory.inventory_value
        if new_quantity == 0:
            new_inventory_value = Decimal("0")
        elif new_inventory_value is not None:
            new_inventory_value -= purchase_values[ingredient_id]
            if new_inventory_value < 0:
                raise InventoryReceiptDeletionError(
                    f"Deleting the selected receipts would make {inventory.ingredient.name} inventory value negative."
                )

        inventory.quantity = new_quantity
        inventory.inventory_value = new_inventory_value
        inventory.full_clean()
        inventory.save(update_fields=("quantity", "inventory_value", "updated_at"))

    attachments = [
        (receipt.invoice.storage, receipt.invoice.name)
        for receipt in receipts
        if receipt.invoice
    ]
    InventoryReceipt.objects.filter(id__in=unique_ids).delete()
    for storage, name in attachments:
        transaction.on_commit(lambda storage=storage, name=name: storage.delete(name))
    return len(receipts)


@transaction.atomic
def consume_inventory(ingredient_id: Any, base_quantity: Decimal) -> InventoryItem:
    inventory = InventoryItem.objects.select_for_update().get(ingredient_id=ingredient_id)
    if base_quantity <= 0:
        raise ValueError("Consumed quantity must be greater than zero.")
    if base_quantity > inventory.quantity:
        raise ValueError("Consumed quantity cannot exceed current inventory.")

    if base_quantity == inventory.quantity:
        inventory.quantity = Decimal("0")
        inventory.inventory_value = Decimal("0")
    else:
        average_cost = inventory.average_cost_per_base_unit
        inventory.quantity -= base_quantity
        if average_cost is not None:
            consumed_value = (base_quantity * average_cost).quantize(
                VALUE_QUANTUM,
                rounding=ROUND_HALF_UP,
            )
            inventory.inventory_value = max(
                (inventory.inventory_value or Decimal("0")) - consumed_value,
                Decimal("0"),
            )
    inventory.save(update_fields=("quantity", "inventory_value", "updated_at"))
    return inventory


def _display_quantity(value: Decimal, base_unit: str) -> str:
    display_value = convert_quantity(value, base_unit, display_unit_for(base_unit))
    return format(display_value.quantize(DISPLAY_QUANTUM, rounding=ROUND_HALF_UP), "f")


def _active_recipe_prefetch() -> Prefetch:
    items = RecipeIngredient.objects.select_related("ingredient", "section").order_by("position")
    sections = RecipeSection.objects.order_by("position").prefetch_related(Prefetch("items", queryset=items))
    return Prefetch(
        "product__recipes",
        queryset=Recipe.objects.filter(is_active=True).prefetch_related(Prefetch("sections", queryset=sections)),
        to_attr="active_recipe_cache",
    )


def calculate_forecast_demand(
    today: date | None = None,
) -> tuple[dict[Any, Decimal], dict[Any, dict[Any, dict[str, Any]]]]:
    totals, sources, _ = calculate_forecast_demand_details(today)
    return totals, sources


def calculate_forecast_demand_details(
    today: date | None = None,
) -> tuple[
    dict[Any, Decimal],
    dict[Any, dict[Any, dict[str, Any]]],
    dict[Any, dict[date, Decimal]],
]:
    start_date = today or timezone.localdate()
    end_date = start_date + timedelta(days=FORECAST_DAYS - 1)
    plans = (
        ProductionPlan.objects.filter(
            planned_date__range=(start_date, end_date),
            status__in=(ProductionPlan.Status.PLANNED, ProductionPlan.Status.CONFIRMED),
        )
        .select_related("product")
        .prefetch_related(_active_recipe_prefetch())
    )
    totals: dict[Any, Decimal] = defaultdict(Decimal)
    sources: dict[Any, dict[Any, dict[str, Any]]] = defaultdict(dict)
    daily_demands: dict[Any, dict[date, Decimal]] = defaultdict(lambda: defaultdict(Decimal))

    for plan in plans:
        planned_quantity = plan.quantity
        if plan.planned_date == start_date:
            planned_quantity = max(plan.quantity - (plan.actual_quantity or 0), 0)
        if planned_quantity == 0:
            continue
        recipes = plan.product.active_recipe_cache
        if not recipes:
            continue
        recipe = recipes[0]
        scale = Decimal(planned_quantity) / Decimal(recipe.yield_quantity)
        for section in recipe.sections.all():
            for recipe_item in section.items.all():
                try:
                    demand = convert_quantity(
                        recipe_item.weight * scale,
                        recipe_item.unit,
                        recipe_item.ingredient.base_unit,
                    )
                except ValueError:
                    continue
                ingredient_id = recipe_item.ingredient_id
                totals[ingredient_id] += demand
                daily_demands[ingredient_id][plan.planned_date] += demand
                source = sources[ingredient_id].setdefault(
                    plan.product_id,
                    {
                        "product_id": str(plan.product_id),
                        "product_name_zh": plan.product.name_zh,
                        "product_name_en": plan.product.name_en,
                        "quantity_base": Decimal("0"),
                    },
                )
                source["quantity_base"] += demand
    return totals, sources, daily_demands


def _preferred_terms() -> dict[Any, SupplierIngredient]:
    terms = (
        SupplierIngredient.objects.filter(is_active=True)
        .select_related("supplier", "ingredient")
        .order_by("ingredient_id", "-is_preferred", "unit_price", "supplier__name")
    )
    result: dict[Any, SupplierIngredient] = {}
    for term in terms:
        result.setdefault(term.ingredient_id, term)
        if term.is_preferred:
            result[term.ingredient_id] = term
    return result


def _round_to_order_multiple(required: Decimal, multiple: Decimal) -> Decimal:
    if required <= 0:
        return Decimal("0")
    if multiple <= 0:
        return required
    return (required / multiple).to_integral_value(rounding=ROUND_CEILING) * multiple


def build_inventory_snapshot(today: date | None = None) -> dict[str, Any]:
    current_date = today or timezone.localdate()
    demand_by_ingredient, sources_by_ingredient, daily_demands_by_ingredient = calculate_forecast_demand_details(
        current_date
    )
    inventory_by_ingredient = {item.ingredient_id: item for item in InventoryItem.objects.select_related("ingredient")}
    terms_by_ingredient = _preferred_terms()
    ingredients = (
        Ingredient.objects.filter(Q(inventory_item__quantity__gt=0) | Q(recipe_items__section__recipe__is_active=True))
        .distinct()
        .order_by("name")
    )
    result_items: list[dict[str, Any]] = []

    for ingredient in ingredients:
        inventory = inventory_by_ingredient.get(ingredient.id)
        stock = inventory.quantity if inventory else Decimal("0")
        safety_days = inventory.safety_buffer_days if inventory else 2
        demand = demand_by_ingredient.get(ingredient.id, Decimal("0"))
        daily_demands = daily_demands_by_ingredient.get(ingredient.id, {})
        production_day_count = len(daily_demands)
        production_day_average = demand / Decimal(production_day_count) if production_day_count else None
        term = terms_by_ingredient.get(ingredient.id)
        lead_time_days = term.lead_time_days if term else 0
        remaining_stock = stock
        covered_production_days = 0
        shortage_date = None
        daily_demand_items: list[dict[str, Any]] = []
        for production_date, production_demand in sorted(daily_demands.items()):
            can_cover = shortage_date is None and remaining_stock >= production_demand
            if can_cover:
                covered_production_days += 1
            elif shortage_date is None:
                shortage_date = production_date
            remaining_stock -= production_demand
            daily_demand_items.append(
                {
                    "date": production_date.isoformat(),
                    "quantity": _display_quantity(production_demand, ingredient.base_unit),
                    "remaining_stock": _display_quantity(remaining_stock, ingredient.base_unit),
                    "is_covered": can_cover,
                }
            )

        recommended_order_date = None
        if production_day_count == 0:
            status = "NO_DEMAND"
        elif shortage_date is None:
            status = "NORMAL"
        else:
            raw_order_date = shortage_date - timedelta(days=lead_time_days + safety_days)
            recommended_order_date = max(current_date, raw_order_date)
            if current_date + timedelta(days=lead_time_days) > shortage_date:
                status = "EMERGENCY"
            elif current_date >= raw_order_date:
                status = "PURCHASE_REQUIRED"
            else:
                status = "WATCH"

        recommended_quantity = None
        if term is not None and shortage_date is not None:
            required_base = max(Decimal("0"), demand - stock)
            try:
                moq_base = convert_quantity(
                    term.minimum_order_quantity,
                    term.minimum_order_unit,
                    ingredient.base_unit,
                )
            except ValueError:
                moq_base = Decimal("0")
            recommended_quantity = _round_to_order_multiple(required_base, moq_base)

        display_unit = display_unit_for(ingredient.base_unit)
        source_items = []
        for source in sources_by_ingredient.get(ingredient.id, {}).values():
            source_items.append(
                {
                    "product_id": source["product_id"],
                    "product_name_zh": source["product_name_zh"],
                    "product_name_en": source["product_name_en"],
                    "quantity": _display_quantity(source["quantity_base"], ingredient.base_unit),
                    "unit": display_unit,
                }
            )
        source_items.sort(key=lambda item: Decimal(item["quantity"]), reverse=True)

        supplier_data = None
        if term is not None:
            supplier_data = {
                "supplier_id": str(term.supplier_id),
                "supplier_name": term.supplier.name,
                "unit_price": format(term.unit_price, "f"),
                "currency": term.currency,
                "price_unit": term.price_unit,
                "lead_time_days": term.lead_time_days,
                "minimum_order_quantity": format(term.minimum_order_quantity, "f"),
                "minimum_order_unit": term.minimum_order_unit,
                "is_preferred": term.is_preferred,
            }

        result_items.append(
            {
                "id": str(inventory.id) if inventory else None,
                "ingredient_id": str(ingredient.id),
                "ingredient_name": ingredient.name,
                "current_stock": _display_quantity(stock, ingredient.base_unit),
                "demand_14_days": _display_quantity(demand, ingredient.base_unit),
                "production_day_count": production_day_count,
                "average_production_day_demand": (
                    _display_quantity(production_day_average, ingredient.base_unit)
                    if production_day_average is not None
                    else None
                ),
                "unit": display_unit,
                "covered_production_days": covered_production_days if production_day_count else None,
                "covers_all_planned_demand": production_day_count > 0 and shortage_date is None,
                "shortage_date": shortage_date.isoformat() if shortage_date else None,
                "recommended_order_date": recommended_order_date.isoformat() if recommended_order_date else None,
                "status": status,
                "safety_buffer_days": safety_days,
                "demand_sources": source_items,
                "daily_demands": daily_demand_items,
                "supplier": supplier_data,
                "recommended_order_quantity": (
                    _display_quantity(recommended_quantity, ingredient.base_unit)
                    if recommended_quantity is not None
                    else None
                ),
            }
        )

    status_priority = {"EMERGENCY": 0, "PURCHASE_REQUIRED": 1, "WATCH": 2, "NORMAL": 3, "NO_DEMAND": 4}
    result_items.sort(key=lambda item: (status_priority[item["status"]], item["ingredient_name"]))
    receipt_ingredient_ids = list(
        RecipeIngredient.objects.filter(
            section__recipe__is_active=True,
            ingredient__is_active=True,
        )
        .order_by()
        .values_list("ingredient_id", flat=True)
        .distinct()
    )
    return {
        "generated_at": timezone.now().isoformat(),
        "horizon_days": FORECAST_DAYS,
        "receipt_ingredient_ids": [str(ingredient_id) for ingredient_id in receipt_ingredient_ids],
        "kpis": {
            "ingredient_count": len(result_items),
            "purchase_required_count": sum(
                item["status"] in ("PURCHASE_REQUIRED", "EMERGENCY") for item in result_items
            ),
            "shortage_within_7_days_count": sum(
                item["shortage_date"] is not None
                and date.fromisoformat(item["shortage_date"]) <= current_date + timedelta(days=6)
                for item in result_items
            ),
            "no_demand_count": sum(item["status"] == "NO_DEMAND" for item in result_items),
        },
        "items": result_items,
    }
