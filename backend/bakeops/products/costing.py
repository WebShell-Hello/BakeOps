from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Prefetch

from bakeops.products.models import Product, Recipe, RecipeIngredient, RecipeSection

COST_QUANTUM = Decimal("0.0001")


def current_product_unit_cost(product: Product) -> Decimal | None:
    items = RecipeIngredient.objects.select_related("ingredient", "ingredient__inventory_item").order_by(
        "position"
    )
    sections = RecipeSection.objects.order_by("position").prefetch_related(
        Prefetch("items", queryset=items)
    )
    recipe = (
        Recipe.objects.filter(product=product, is_active=True)
        .prefetch_related(Prefetch("sections", queryset=sections))
        .first()
    )
    if recipe is None:
        return None
    return current_recipe_unit_cost(recipe)


def current_recipe_unit_cost(recipe: Recipe) -> Decimal | None:
    result = current_estimated_cost(recipe)
    if not result["is_complete"] or result["amount"] is None:
        return None
    return (Decimal(str(result["amount"])) / Decimal(recipe.yield_quantity)).quantize(COST_QUANTUM)


def current_estimated_cost(recipe: Recipe) -> dict[str, object]:
    from bakeops.inventory.services import convert_quantity

    known_recipe_cost = Decimal("0")
    missing_ingredients: set[str] = set()
    ingredient_count = 0

    for section in recipe.sections.all():
        for item in section.items.all():
            ingredient_count += 1
            try:
                inventory = item.ingredient.inventory_item
            except ObjectDoesNotExist:
                missing_ingredients.add(item.ingredient.name)
                continue
            average_cost = inventory.average_cost_per_base_unit
            if average_cost is None:
                missing_ingredients.add(item.ingredient.name)
                continue
            try:
                base_quantity = convert_quantity(
                    item.weight,
                    item.unit,
                    item.ingredient.base_unit,
                )
            except ValueError:
                missing_ingredients.add(item.ingredient.name)
                continue
            known_recipe_cost += base_quantity * average_cost

    amount = None
    if ingredient_count:
        amount = known_recipe_cost.quantize(COST_QUANTUM, rounding=ROUND_HALF_UP)
    return {
        "amount": format(amount, "f") if amount is not None else None,
        "currency": "GBP",
        "is_complete": ingredient_count > 0 and not missing_ingredients,
        "missing_ingredient_count": len(missing_ingredients),
        "missing_ingredients": sorted(missing_ingredients),
    }
