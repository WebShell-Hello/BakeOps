from decimal import Decimal

import pytest
from django.core.management import call_command

from bakeops.products.models import Ingredient, Product, RecipeIngredient


@pytest.mark.django_db
def test_seed_demo_products_is_idempotent_and_preserves_recipe_totals() -> None:
    call_command("seed_demo_products")
    call_command("seed_demo_products")

    assert Product.objects.count() == 7
    assert Ingredient.objects.count() == 45
    assert RecipeIngredient.objects.count() == 62

    custard_bun = Product.objects.get(code="CUSTARD-BUN").recipes.get(is_active=True)
    cranberry_bread = Product.objects.get(code="CRANBERRY-PECAN-BREAD").recipes.get(is_active=True)
    mantou = Product.objects.get(code="STEAMED-MANTOU").recipes.get(is_active=True)
    liangpi = Product.objects.get(code="LIANGPI").recipes.get(is_active=True)
    porridge = Product.objects.get(code="OSMANTHUS-LONGAN-EIGHT-TREASURE-PORRIDGE").recipes.get(
        is_active=True
    )
    egg_custard = Product.objects.get(code="BROWN-SUGAR-GINGER-MILK-EGG-CUSTARD").recipes.get(
        is_active=True
    )
    hu_la_tang = Product.objects.get(code="HU-LA-TANG").recipes.get(is_active=True)

    assert custard_bun.total_weight == Decimal("814.500")
    assert cranberry_bread.total_weight == Decimal("540.000")
    assert mantou.total_weight == Decimal("770.000")
    assert liangpi.total_weight == Decimal("523.000")
    assert porridge.total_weight == Decimal("3590.000")
    assert egg_custard.total_weight == Decimal("340.000")
    assert hu_la_tang.total_weight == Decimal("8585.000")
    assert custard_bun.sections.count() == 2
    assert cranberry_bread.sections.count() == 3
    assert not RecipeIngredient.objects.exclude(estimated_price__isnull=True).exists()


@pytest.mark.django_db
def test_seed_leadership_products_merges_duplicate_section_ingredients() -> None:
    call_command("seed_leadership_products")
    call_command("seed_leadership_products")

    assert Product.objects.count() == 30

    recipe = Product.objects.get(code="BLUEBERRY-CHEESE-DANISH").recipes.get(version=1)
    sugar_items = RecipeIngredient.objects.filter(
        section__recipe=recipe,
        ingredient__name="砂糖",
    )

    assert sugar_items.count() == 1
    assert sugar_items.get().weight == Decimal("45.000")
