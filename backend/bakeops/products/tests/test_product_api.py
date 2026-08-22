from decimal import Decimal

import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APIClient

from bakeops.inventory.models import InventoryItem
from bakeops.products.costing import current_product_unit_cost
from bakeops.products.models import Ingredient, Product, Recipe, RecipeIngredient, RecipeSection
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    admin = User.objects.create_superuser(
        username="product-admin",
        email="product-admin@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.mark.django_db
def test_product_list_returns_seeded_nested_recipe(admin_client: APIClient) -> None:
    call_command("seed_demo_products")

    response = admin_client.get(reverse("product-list"))

    assert response.status_code == 200
    custard_bun = next(item for item in response.data if item["name_zh"] == "奶黄包")
    assert custard_bun["name_en"] == "Custard Bun"
    assert custard_bun["active_recipe"]["total_weight"] == "814.500"
    assert len(custard_bun["active_recipe"]["sections"]) == 2
    assert sum(len(section["items"]) for section in custard_bun["active_recipe"]["sections"]) == 12
    ingredient_ids = [
        item["ingredient_id"]
        for section in custard_bun["active_recipe"]["sections"]
        for item in section["items"]
    ]
    assert len(set(ingredient_ids)) == 11
    assert all(
        item["estimated_price"] is None
        for section in custard_bun["active_recipe"]["sections"]
        for item in section["items"]
    )


@pytest.mark.django_db
def test_product_current_estimated_cost_uses_inventory_weighted_average_for_recipe_batch(
    admin_client: APIClient,
) -> None:
    product = Product.objects.create(code="COSTED-PRODUCT", name_zh="成本产品", name_en="Costed Product")
    recipe = Recipe.objects.create(product=product, yield_quantity=2, yield_unit="个", is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="配方", position=0)
    flour = Ingredient.objects.create(name="成本面粉", base_unit="g")
    butter = Ingredient.objects.create(name="成本黄油", base_unit="g")
    sugar = Ingredient.objects.create(name="缺少成本糖", base_unit="g")
    InventoryItem.objects.create(ingredient=flour, quantity="60000", inventory_value="160.0000")
    InventoryItem.objects.create(ingredient=butter, quantity="10000", inventory_value="60.0000")
    RecipeIngredient.objects.create(section=section, ingredient=flour, weight="120", unit="g", position=0)
    RecipeIngredient.objects.create(section=section, ingredient=butter, weight="40", unit="g", position=1)
    RecipeIngredient.objects.create(section=section, ingredient=sugar, weight="15", unit="g", position=2)

    incomplete = admin_client.get(reverse("product-list")).data[0]["current_estimated_cost"]

    assert incomplete["amount"] == "0.5600"
    assert incomplete["is_complete"] is False
    assert incomplete["missing_ingredient_count"] == 1
    assert incomplete["missing_ingredients"] == ["缺少成本糖"]

    InventoryItem.objects.create(ingredient=sugar, quantity="10000", inventory_value="12.0000")
    complete = admin_client.get(reverse("product-list")).data[0]["current_estimated_cost"]

    assert complete["amount"] == "0.5780"
    assert complete["is_complete"] is True
    assert complete["missing_ingredient_count"] == 0
    assert current_product_unit_cost(product) == Decimal("0.2890")


@pytest.mark.django_db
def test_product_and_ingredient_crud(admin_client: APIClient) -> None:
    create_product = admin_client.post(
        reverse("product-list"),
        {
            "name_zh": "测试面包",
            "name_en": "Test Bread",
            "sale_status": "ON_SALE",
            "notes": "测试备注",
            "yield_quantity": 6,
            "yield_unit": "个",
            "production_description": "混合并烘烤。",
        },
        format="json",
    )
    assert create_product.status_code == 201
    product = Product.objects.get(name_zh="测试面包")

    update_product = admin_client.put(
        reverse("product-detail", kwargs={"pk": product.id}),
        {
            "name_zh": "测试面包（已编辑）",
            "name_en": "Edited Test Bread",
            "sale_status": "ON_SALE",
            "notes": "测试备注",
            "yield_quantity": 6,
            "yield_unit": "个",
            "production_description": "混合并烘烤。",
        },
        format="json",
    )
    assert update_product.status_code == 200
    product.refresh_from_db()
    assert product.name_zh == "测试面包（已编辑）"
    assert product.name_en == "Edited Test Bread"

    create_item = admin_client.post(
        reverse("product-ingredient-create", kwargs={"product_id": product.id}),
        {
            "ingredient_name": "测试面粉",
            "section_name": "主面团",
            "weight": "120.000",
            "unit": "g",
            "preparation_note": "过筛",
        },
        format="json",
    )
    assert create_item.status_code == 201
    assert create_item.data["estimated_price"] is None

    item = RecipeIngredient.objects.get(ingredient__name="测试面粉")
    update_item = admin_client.put(
        reverse("product-ingredient-detail", kwargs={"pk": item.id}),
        {
            "ingredient_name": "测试面粉",
            "section_name": "主面团",
            "weight": "150.000",
            "unit": "g",
            "preparation_note": "过筛后使用",
        },
        format="json",
    )
    assert update_item.status_code == 200
    item.refresh_from_db()
    assert str(item.weight) == "150.000"

    delete_item = admin_client.delete(reverse("product-ingredient-detail", kwargs={"pk": item.id}))
    assert delete_item.status_code == 204
    assert not RecipeIngredient.objects.filter(pk=item.id).exists()


@pytest.mark.django_db
def test_updating_recipe_yield_scales_every_ingredient_weight(admin_client: APIClient) -> None:
    create_product = admin_client.post(
        reverse("product-list"),
        {
            "name_zh": "比例测试产品",
            "name_en": "Scaling Test Product",
            "sale_status": "ON_SALE",
            "notes": "",
            "yield_quantity": 4,
            "yield_unit": "个",
            "production_description": "",
        },
        format="json",
    )
    assert create_product.status_code == 201
    product = Product.objects.get(name_zh="比例测试产品")

    for ingredient_name, weight in (("比例面粉", "10.001"), ("比例酵母", "3.333")):
        response = admin_client.post(
            reverse("product-ingredient-create", kwargs={"product_id": product.id}),
            {
                "ingredient_name": ingredient_name,
                "section_name": "主配方",
                "weight": weight,
                "unit": "g",
                "preparation_note": "",
            },
            format="json",
        )
        assert response.status_code == 201

    update_product = admin_client.put(
        reverse("product-detail", kwargs={"pk": product.id}),
        {
            "name_zh": "比例测试产品",
            "name_en": "Scaling Test Product",
            "sale_status": "ON_SALE",
            "notes": "",
            "yield_quantity": 6,
            "yield_unit": "个",
            "production_description": "",
        },
        format="json",
    )

    assert update_product.status_code == 200
    recipe = update_product.data["active_recipe"]
    assert recipe["yield_quantity"] == 6
    assert recipe["total_weight"] == "20.002"
    weights = {item["ingredient_name"]: item["weight"] for section in recipe["sections"] for item in section["items"]}
    assert weights == {"比例面粉": "15.002", "比例酵母": "5.000"}
