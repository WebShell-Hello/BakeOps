from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from typing import Any

from django.utils import timezone

from bakeops.events.models import BusinessEvent
from bakeops.inventory.models import InventoryItem, ProductionPlan
from bakeops.inventory.services import convert_quantity, display_unit_for
from bakeops.products.models import Recipe

DISPLAY_QUANTUM = Decimal("0.001")


def event_status(event: BusinessEvent, today: date | None = None) -> str:
    current_date = today or timezone.localdate()
    if event.end_date < current_date:
        return "COMPLETED"
    preparation_start = event.start_date - timedelta(days=event.preparation_days)
    if current_date < preparation_start:
        return "NOT_PREPARING"

    items = list(event.checklist_items.all())
    completion_ratio = (
        Decimal(sum(item.is_completed for item in items)) / Decimal(len(items))
        if items
        else Decimal("0")
    )
    if event.preparation_days > 0 and current_date < event.start_date:
        elapsed_days = max(0, (current_date - preparation_start).days)
        expected_ratio = min(Decimal("1"), Decimal(elapsed_days) / Decimal(event.preparation_days))
        if completion_ratio + Decimal("0.10") < expected_ratio:
            return "PREPARATION_RISK"
    if current_date >= event.start_date or (event.start_date - current_date).days <= 3:
        return "IMMINENT"
    return "PREPARING"


def build_event_advice(event: BusinessEvent, today: date | None = None) -> dict[str, list[dict[str, Any]]]:
    current_date = today or timezone.localdate()
    products = list(event.focus_products.all())
    product_ids = [product.id for product in products]
    plans = ProductionPlan.objects.filter(
        product_id__in=product_ids,
        planned_date__range=(event.start_date, event.end_date),
        status__in=(ProductionPlan.Status.PLANNED, ProductionPlan.Status.CONFIRMED),
    )
    planned_by_product: dict[Any, int] = defaultdict(int)
    for plan in plans:
        quantity = plan.quantity
        if plan.planned_date == current_date:
            quantity = max(plan.quantity - (plan.actual_quantity or 0), 0)
        planned_by_product[plan.product_id] += quantity

    recipes = {
        recipe.product_id: recipe
        for recipe in Recipe.objects.filter(product_id__in=product_ids, is_active=True)
        .select_related("product")
        .prefetch_related("sections__items__ingredient")
    }
    positive_change = max(event.expected_sales_change, Decimal("0"))
    product_suggestions: list[dict[str, Any]] = []
    ingredient_original: dict[Any, Decimal] = defaultdict(Decimal)
    ingredient_extra: dict[Any, Decimal] = defaultdict(Decimal)
    ingredients: dict[Any, Any] = {}

    for product in products:
        current_quantity = planned_by_product.get(product.id, 0)
        recipe = recipes.get(product.id)
        baseline = current_quantity or (recipe.yield_quantity if recipe else 0)
        suggested_quantity = int(
            (Decimal(baseline) * (Decimal("1") + positive_change / Decimal("100"))).to_integral_value(
                rounding=ROUND_CEILING
            )
        )
        increase = max(suggested_quantity - current_quantity, 0)
        product_suggestions.append(
            {
                "product_id": str(product.id),
                "product_name_zh": product.name_zh,
                "product_name_en": product.name_en,
                "current_quantity": current_quantity,
                "suggested_quantity": suggested_quantity,
                "suggested_increase": increase,
            }
        )
        if recipe is None:
            continue
        for section in recipe.sections.all():
            for item in section.items.all():
                ingredients[item.ingredient_id] = item.ingredient
                try:
                    per_recipe_base = convert_quantity(item.weight, item.unit, item.ingredient.base_unit)
                except ValueError:
                    continue
                ingredient_original[item.ingredient_id] += (
                    per_recipe_base * Decimal(current_quantity) / Decimal(recipe.yield_quantity)
                )
                ingredient_extra[item.ingredient_id] += (
                    per_recipe_base * Decimal(increase) / Decimal(recipe.yield_quantity)
                )

    inventory = {
        item.ingredient_id: item.quantity
        for item in InventoryItem.objects.filter(ingredient_id__in=ingredients).select_related("ingredient")
    }
    ingredient_suggestions: list[dict[str, Any]] = []
    for ingredient_id, ingredient in ingredients.items():
        stock = inventory.get(ingredient_id, Decimal("0"))
        original = ingredient_original[ingredient_id]
        extra = ingredient_extra[ingredient_id]
        shortfall = max(Decimal("0"), original + extra - stock)
        unit = display_unit_for(ingredient.base_unit)
        ingredient_suggestions.append(
            {
                "ingredient_id": str(ingredient_id),
                "ingredient_name": ingredient.name,
                "current_stock": _display(stock, ingredient.base_unit),
                "original_demand": _display(original, ingredient.base_unit),
                "extra_demand": _display(extra, ingredient.base_unit),
                "recommended_additional_quantity": _display(shortfall, ingredient.base_unit),
                "recommendation": "INCREASE" if shortfall > 0 else "SUFFICIENT",
                "unit": unit,
            }
        )
    ingredient_suggestions.sort(
        key=lambda item: (item["recommendation"] != "INCREASE", -Decimal(item["extra_demand"]), item["ingredient_name"])
    )
    return {
        "production_suggestions": product_suggestions,
        "inventory_suggestions": ingredient_suggestions,
    }


def _display(value: Decimal, base_unit: str) -> str:
    converted = convert_quantity(value, base_unit, display_unit_for(base_unit))
    return format(converted.quantize(DISPLAY_QUANTUM, rounding=ROUND_HALF_UP), "f")
