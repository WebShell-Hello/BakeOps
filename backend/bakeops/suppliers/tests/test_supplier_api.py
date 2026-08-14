import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APIClient

from bakeops.products.models import Ingredient
from bakeops.suppliers.models import Supplier, SupplierIngredient
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    admin = User.objects.create_superuser(
        username="supplier-admin",
        email="supplier-admin@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.mark.django_db
def test_supplier_crud_search_and_active_ingredient_count(admin_client: APIClient) -> None:
    supplier_response = admin_client.post(
        reverse("supplier-list"),
        {
            "name": "Test Bakery Supplier",
            "address": "London",
            "contact_name": "Joe Lee",
            "phone": "07123 456789",
            "email": "SALES@SUPPLIER.EXAMPLE",
            "notes": "常用供应商",
        },
        format="json",
    )
    assert supplier_response.status_code == 201
    assert supplier_response.data["email"] == "sales@supplier.example"

    ingredient = Ingredient.objects.create(name="测试高筋面粉", base_unit="g")
    term_response = admin_client.post(
        reverse("supplier-ingredient-create", kwargs={"supplier_id": supplier_response.data["id"]}),
        {
            "ingredient": str(ingredient.id),
            "unit_price": "1.2000",
            "currency": "gbp",
            "price_unit": "kg",
            "minimum_order_quantity": "25.000",
            "minimum_order_unit": "kg",
            "lead_time_days": 7,
            "notes": "100kg以上优惠",
            "is_active": True,
            "is_preferred": True,
        },
        format="json",
    )
    assert term_response.status_code == 201

    search_response = admin_client.get(reverse("supplier-list"), {"search": "Joe"})
    assert search_response.status_code == 200
    assert len(search_response.data) == 1
    assert search_response.data[0]["supplied_ingredient_count"] == 1
    assert search_response.data[0]["supplied_ingredients"][0]["is_preferred"] is True

    update_response = admin_client.patch(
        reverse("supplier-detail", kwargs={"pk": supplier_response.data["id"]}),
        {"notes": "已更新备注"},
        format="json",
    )
    assert update_response.status_code == 200
    assert update_response.data["notes"] == "已更新备注"


@pytest.mark.django_db
def test_preferred_supplier_moves_atomically_and_deactivation_clears_it(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="首选测试黄油", base_unit="g")
    suppliers = [Supplier.objects.create(code=f"SUP-TEST-{index}", name=f"Supplier {index}") for index in range(2)]
    first = SupplierIngredient.objects.create(
        supplier=suppliers[0],
        ingredient=ingredient,
        unit_price="5.8000",
        price_unit="kg",
        minimum_order_quantity="10.000",
        minimum_order_unit="kg",
        is_preferred=True,
    )
    second = SupplierIngredient.objects.create(
        supplier=suppliers[1],
        ingredient=ingredient,
        unit_price="5.5000",
        price_unit="kg",
        minimum_order_quantity="25.000",
        minimum_order_unit="kg",
    )

    preferred_response = admin_client.patch(
        reverse("supplier-ingredient-detail", kwargs={"pk": second.id}),
        {"is_preferred": True},
        format="json",
    )
    assert preferred_response.status_code == 200
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.is_preferred is False
    assert second.is_preferred is True

    deactivate_response = admin_client.patch(
        reverse("supplier-ingredient-detail", kwargs={"pk": second.id}),
        {"is_active": False},
        format="json",
    )
    assert deactivate_response.status_code == 200
    second.refresh_from_db()
    assert second.is_active is False
    assert second.is_preferred is False


@pytest.mark.django_db
def test_supplier_rejects_duplicate_ingredient_terms(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="重复测试糖", base_unit="g")
    supplier = Supplier.objects.create(code="SUP-DUPLICATE", name="Duplicate Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="1.0000",
        minimum_order_quantity="10.000",
    )

    response = admin_client.post(
        reverse("supplier-ingredient-create", kwargs={"supplier_id": supplier.id}),
        {
            "ingredient": str(ingredient.id),
            "unit_price": "1.1000",
            "currency": "GBP",
            "price_unit": "kg",
            "minimum_order_quantity": "20.000",
            "minimum_order_unit": "kg",
            "lead_time_days": 3,
            "notes": "",
            "is_active": True,
            "is_preferred": False,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "ingredient" in response.data


@pytest.mark.django_db
def test_seed_demo_suppliers_is_idempotent_and_uses_recipe_ingredients() -> None:
    call_command("seed_demo_products")
    call_command("seed_demo_suppliers")
    call_command("seed_demo_suppliers")

    assert Supplier.objects.count() == 50
    assert all(supplier.supplied_ingredients.count() >= 1 for supplier in Supplier.objects.all())
    recipe_ingredient_ids = set(
        Ingredient.objects.filter(recipe_items__isnull=False).values_list("id", flat=True)
    )
    assert not SupplierIngredient.objects.exclude(ingredient_id__in=recipe_ingredient_ids).exists()
    assert SupplierIngredient.objects.filter(is_preferred=True).count() == 8
