from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.access.models import Role
from bakeops.employees.models import Employee
from bakeops.inventory.models import InventoryItem, InventoryReceipt, ProductionPlan, PurchaseRequest
from bakeops.inventory.services import calculate_forecast_demand, consume_inventory
from bakeops.navigation.models import NavigationItem
from bakeops.products.models import Ingredient, Product, Recipe, RecipeIngredient, RecipeSection
from bakeops.suppliers.models import Supplier, SupplierIngredient
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    user = User.objects.create_superuser(
        username="inventory-admin",
        email="inventory-admin@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_inventory_overview_calculates_recipe_demand_and_purchase_timing(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Forecast flour", base_unit="g")
    product = Product.objects.create(code="FORECAST-BREAD", name_zh="预测面包", name_en="Forecast Bread")
    recipe = Recipe.objects.create(product=product, yield_quantity=10, yield_unit="个", is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="面团", position=0)
    RecipeIngredient.objects.create(
        section=section,
        ingredient=ingredient,
        weight="1000.000",
        unit="g",
        position=0,
    )
    ProductionPlan.objects.create(
        reference="PLAN-FORECAST",
        product=product,
        planned_date=timezone.localdate() + timedelta(days=2),
        quantity=140,
        status=ProductionPlan.Status.CONFIRMED,
    )
    InventoryItem.objects.create(ingredient=ingredient, quantity="80000.000", safety_buffer_days=2)
    supplier = Supplier.objects.create(code="SUP-FORECAST", name="Forecast Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="1.2000",
        price_unit="kg",
        minimum_order_quantity="25.000",
        minimum_order_unit="kg",
        lead_time_days=7,
        is_preferred=True,
    )

    response = admin_client.get(reverse("inventory-overview"))

    assert response.status_code == 200
    item = response.data["items"][0]
    assert item["current_stock"] == "80.000"
    assert item["demand_14_days"] == "14.000"
    assert item["production_day_count"] == 1
    assert item["average_production_day_demand"] == "14.000"
    assert item["covered_production_days"] == 1
    assert item["covers_all_planned_demand"] is True
    assert item["shortage_date"] is None
    assert item["status"] == "NORMAL"
    assert item["supplier"]["lead_time_days"] == 7
    assert item["demand_sources"][0]["quantity"] == "14.000"
    assert str(ingredient.id) in response.data["receipt_ingredient_ids"]


@pytest.mark.django_db
def test_inventory_overview_marks_immediate_and_no_demand_items(admin_client: APIClient) -> None:
    demanded = Ingredient.objects.create(name="Urgent butter", base_unit="g")
    unused = Ingredient.objects.create(name="Unused paste", base_unit="g")
    product = Product.objects.create(code="URGENT-PRODUCT", name_zh="紧急产品", name_en="Urgent Product")
    recipe = Recipe.objects.create(product=product, yield_quantity=10, is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="配方", position=0)
    RecipeIngredient.objects.create(section=section, ingredient=demanded, weight="1000", unit="g", position=0)
    RecipeIngredient.objects.create(section=section, ingredient=unused, weight="100", unit="g", position=1)
    ProductionPlan.objects.create(
        reference="PLAN-URGENT",
        product=product,
        planned_date=timezone.localdate() + timedelta(days=1),
        quantity=140,
        status=ProductionPlan.Status.CONFIRMED,
    )
    InventoryItem.objects.create(ingredient=demanded, quantity="8000", safety_buffer_days=2)
    InventoryItem.objects.create(ingredient=unused, quantity="5000", safety_buffer_days=2)
    supplier = Supplier.objects.create(code="SUP-URGENT", name="Urgent Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=demanded,
        unit_price="5.8000",
        minimum_order_quantity="10",
        minimum_order_unit="kg",
        lead_time_days=7,
        is_preferred=True,
    )
    ProductionPlan.objects.filter(reference="PLAN-URGENT").update(status=ProductionPlan.Status.CANCELLED)

    no_demand_response = admin_client.get(reverse("inventory-overview"))
    assert all(item["status"] == "NO_DEMAND" for item in no_demand_response.data["items"])

    ProductionPlan.objects.filter(reference="PLAN-URGENT").update(status=ProductionPlan.Status.CONFIRMED)
    urgent_response = admin_client.get(reverse("inventory-overview"))
    urgent_item = next(item for item in urgent_response.data["items"] if item["ingredient_name"] == "Urgent butter")
    assert urgent_item["covered_production_days"] == 0
    assert urgent_item["shortage_date"] == (timezone.localdate() + timedelta(days=1)).isoformat()
    assert urgent_item["status"] == "EMERGENCY"
    assert urgent_item["recommended_order_date"] == timezone.localdate().isoformat()
    assert urgent_response.data["kpis"]["purchase_required_count"] == 1


@pytest.mark.django_db
def test_create_purchase_request_uses_supplier_price_snapshot(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Order flour", base_unit="g")
    supplier = Supplier.objects.create(code="SUP-ORDER", name="Order Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="1.2500",
        currency="GBP",
        price_unit="kg",
        minimum_order_quantity="25",
        minimum_order_unit="kg",
        is_preferred=True,
    )

    response = admin_client.post(
        reverse("inventory-purchase-request-create"),
        {"ingredient_id": str(ingredient.id), "quantity": "100.000", "unit": "kg"},
        format="json",
    )

    assert response.status_code == 201
    purchase_request = PurchaseRequest.objects.get()
    assert purchase_request.supplier == supplier
    assert purchase_request.unit_price == Decimal("1.2500")
    assert response.data["reference"].startswith("PR-")


@pytest.mark.django_db
def test_inventory_receipt_increases_stock_and_recalculates_purchase_status(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Received flour", base_unit="g")
    product = Product.objects.create(code="RECEIPT-BREAD", name_zh="入库面包", name_en="Receipt Bread")
    recipe = Recipe.objects.create(product=product, yield_quantity=10, is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="面团", position=0)
    RecipeIngredient.objects.create(section=section, ingredient=ingredient, weight="1000", unit="g", position=0)
    ProductionPlan.objects.create(
        reference="PLAN-RECEIPT",
        product=product,
        planned_date=timezone.localdate() + timedelta(days=1),
        quantity=140,
        status=ProductionPlan.Status.CONFIRMED,
    )
    inventory = InventoryItem.objects.create(
        ingredient=ingredient,
        quantity="8000",
        inventory_value="9.6000",
        safety_buffer_days=2,
    )
    supplier = Supplier.objects.create(code="SUP-RECEIPT", name="Receipt Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="1.2000",
        price_unit="kg",
        minimum_order_quantity="25",
        minimum_order_unit="kg",
        lead_time_days=7,
        is_preferred=True,
    )
    before = admin_client.get(reverse("inventory-overview"))
    assert before.data["items"][0]["status"] == "EMERGENCY"

    response = admin_client.post(
        reverse("inventory-receipt-create"),
        {
            "ingredient_id": str(ingredient.id),
            "supplier_id": str(supplier.id),
            "quantity": "25.000",
            "unit": "kg",
            "unit_price": "1.3500",
            "received_at": "2026-08-12T09:30:00Z",
            "notes": "Delivered",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["current_stock"] == "33.000"
    inventory.refresh_from_db()
    assert inventory.quantity == Decimal("33000.000")
    assert inventory.inventory_value == Decimal("43.3500")
    receipt = InventoryReceipt.objects.get()
    assert receipt.base_quantity == Decimal("25000.000")
    assert receipt.supplier == supplier
    assert receipt.unit_price == Decimal("1.3500")
    assert response.data["total_cost"] == "33.75"
    after = admin_client.get(reverse("inventory-overview"))
    assert after.data["items"][0]["current_stock"] == "33.000"
    assert after.data["items"][0]["status"] == "NORMAL"

    records = admin_client.get(reverse("inventory-receipt-create"), {"search": "Receipt Supplier"})
    assert records.status_code == 200
    assert len(records.data) == 1
    assert records.data[0]["reference"] == receipt.reference
    assert records.data[0]["received_at"] == "2026-08-12T10:30:00+01:00"


@pytest.mark.django_db
def test_inventory_consumption_preserves_moving_average_cost() -> None:
    ingredient = Ingredient.objects.create(name="Valued flour", base_unit="g")
    inventory = InventoryItem.objects.create(
        ingredient=ingredient,
        quantity="100000.000",
        inventory_value="320.0000",
    )

    consume_inventory(ingredient.id, Decimal("20000.000"))

    inventory.refresh_from_db()
    assert inventory.quantity == Decimal("80000.000")
    assert inventory.inventory_value == Decimal("256.0000")
    assert inventory.average_cost_per_base_unit == Decimal("0.0032")


@pytest.mark.django_db
def test_inventory_receipt_recalculates_weighted_average_cost(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Weighted flour", base_unit="g")
    inventory = InventoryItem.objects.create(
        ingredient=ingredient,
        quantity="60000.000",
        inventory_value="160.0000",
    )
    supplier = Supplier.objects.create(code="SUP-WEIGHTED", name="Weighted Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="4.0000",
        currency="GBP",
        price_unit="kg",
        minimum_order_quantity="1",
        minimum_order_unit="kg",
        is_preferred=True,
    )

    response = admin_client.post(
        reverse("inventory-receipt-create"),
        {
            "ingredient_id": str(ingredient.id),
            "supplier_id": str(supplier.id),
            "quantity": "40.000",
            "unit": "kg",
            "unit_price": "4.0000",
            "received_at": "2026-08-14T09:30:00Z",
        },
        format="json",
    )

    assert response.status_code == 201
    inventory.refresh_from_db()
    assert inventory.quantity == Decimal("100000.000")
    assert inventory.inventory_value == Decimal("320.0000")
    assert inventory.average_cost_per_base_unit * Decimal("1000") == Decimal("3.2000")


@pytest.mark.django_db
def test_inventory_receipt_requires_active_supplier_term(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Receipt sugar", base_unit="g")
    supplier = Supplier.objects.create(code="SUP-NOT-CONFIGURED", name="Unconfigured Supplier")

    response = admin_client.post(
        reverse("inventory-receipt-create"),
        {
            "ingredient_id": str(ingredient.id),
            "supplier_id": str(supplier.id),
            "quantity": "10.000",
            "unit": "kg",
            "unit_price": "0.9500",
            "received_at": "2026-08-12T09:30:00Z",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "supplier_id" in response.data
    assert not InventoryReceipt.objects.exists()


@pytest.mark.django_db
def test_seed_demo_inventory_is_idempotent() -> None:
    call_command("seed_demo_products")
    call_command("seed_demo_inventory")
    initial_plan_count = ProductionPlan.objects.count()
    initial_inventory_count = InventoryItem.objects.count()

    call_command("seed_demo_inventory")

    assert ProductionPlan.objects.count() == initial_plan_count
    assert initial_plan_count > 20
    assert InventoryItem.objects.count() == initial_inventory_count


@pytest.mark.django_db
def test_production_plan_overview_returns_kpis_and_derived_status(admin_client: APIClient) -> None:
    today = timezone.localdate()
    product = Product.objects.create(code="PLAN-PRODUCT", name_zh="计划产品", name_en="Plan Product")
    ProductionPlan.objects.create(
        reference="PLAN-TODAY",
        product=product,
        planned_date=today,
        quantity=100,
        actual_quantity=75,
    )
    ProductionPlan.objects.create(
        reference="PLAN-TOMORROW",
        product=product,
        planned_date=today + timedelta(days=1),
        quantity=120,
    )

    response = admin_client.get(
        reverse("production-plan-list-create"),
        {"start": today.isoformat(), "end": (today + timedelta(days=6)).isoformat()},
    )

    assert response.status_code == 200
    assert response.data["kpis"] == {
        "today_planned": 100,
        "today_actual": 75,
        "future_7_days_planned": 220,
        "planned_product_count": 1,
    }
    assert response.data["plans"][0]["difference"] == -25
    assert response.data["plans"][0]["completion_rate"] == 75.0
    assert response.data["plans"][0]["display_status"] == "IN_PROGRESS"
    assert response.data["plans"][1]["display_status"] == "PLANNED"

    single_day_response = admin_client.get(
        reverse("production-plan-list-create"),
        {"start": today.isoformat(), "end": today.isoformat()},
    )

    assert single_day_response.status_code == 200
    assert [plan["reference"] for plan in single_day_response.data["plans"]] == ["PLAN-TODAY"]


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_anonymous_production_plan_access_is_read_only_when_page_is_public() -> None:
    today = timezone.localdate()
    product = Product.objects.create(code="PUBLIC-PLAN-PRODUCT", name_zh="公开计划产品", name_en="Public Plan Product")
    ProductionPlan.objects.create(
        reference="PLAN-PUBLIC-READ",
        product=product,
        planned_date=today,
        quantity=100,
        actual_quantity=80,
    )
    anonymous_role = Role.objects.get(code=Role.ANONYMOUS_ROLE_CODE)
    anonymous_role.anonymous_access_mode = Role.AnonymousAccessMode.SYSTEM_PAGE
    anonymous_role.pages.set([NavigationItem.objects.get(key="planning.production")])
    anonymous_role.save(update_fields=("anonymous_access_mode", "updated_at"))
    client = APIClient()

    read_response = client.get(
        reverse("production-plan-list-create"),
        {"start": today.isoformat(), "end": today.isoformat()},
    )
    write_response = client.post(
        reverse("production-plan-list-create"),
        {
            "production_date": today.isoformat(),
            "items": [{"product_id": str(product.id), "planned_quantity": 120}],
        },
        format="json",
    )

    assert read_response.status_code == 200
    assert read_response.data["plans"][0]["planned_quantity"] == 100
    assert write_response.status_code == 403
    assert ProductionPlan.objects.get(reference="PLAN-PUBLIC-READ").quantity == 100


@pytest.mark.django_db
def test_batch_create_production_plans_updates_same_product_and_date(admin_client: APIClient) -> None:
    product = Product.objects.create(code="BATCH-PRODUCT", name_zh="批量产品", name_en="Batch Product")
    production_date = timezone.localdate() + timedelta(days=1)
    payload = {
        "production_date": production_date.isoformat(),
        "items": [{"product_id": str(product.id), "planned_quantity": 180}],
        "notes": "Weekend demand",
    }

    first = admin_client.post(reverse("production-plan-list-create"), payload, format="json")
    payload["items"][0]["planned_quantity"] = 200
    second = admin_client.post(reverse("production-plan-list-create"), payload, format="json")

    assert first.status_code == 201
    assert second.status_code == 201
    assert ProductionPlan.objects.count() == 1
    plan = ProductionPlan.objects.get()
    assert plan.quantity == 200
    assert plan.product == product
    assert plan.notes == "Weekend demand"


@pytest.mark.django_db
def test_today_inventory_forecast_uses_remaining_production_quantity(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Plan flour", base_unit="g")
    product = Product.objects.create(code="ACTUAL-PRODUCT", name_zh="实际产品", name_en="Actual Product")
    recipe = Recipe.objects.create(product=product, yield_quantity=10, is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="配方", position=0)
    RecipeIngredient.objects.create(section=section, ingredient=ingredient, weight="1000", unit="g", position=0)
    plan = ProductionPlan.objects.create(
        reference="PLAN-ACTUAL",
        product=product,
        planned_date=timezone.localdate(),
        quantity=100,
    )

    response = admin_client.patch(
        reverse("production-plan-detail", args=(plan.id,)),
        {"actual_quantity": 90},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["difference"] == -10
    assert response.data["display_status"] == "IN_PROGRESS"
    demand, _ = calculate_forecast_demand(timezone.localdate())
    assert demand[ingredient.id] == Decimal("1000")


@pytest.mark.django_db
def test_recording_actual_production_captures_current_unit_material_cost(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Snapshot flour", base_unit="g")
    product = Product.objects.create(code="SNAPSHOT-PRODUCT", name_zh="成本快照产品", name_en="Cost Snapshot")
    recipe = Recipe.objects.create(product=product, yield_quantity=1, is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="配方", position=0)
    RecipeIngredient.objects.create(section=section, ingredient=ingredient, weight="1", unit="g", position=0)
    InventoryItem.objects.create(ingredient=ingredient, quantity="100", inventory_value="200.0000")
    plan = ProductionPlan.objects.create(
        reference="PLAN-COST-SNAPSHOT",
        product=product,
        planned_date=timezone.localdate(),
        quantity=10,
    )

    response = admin_client.patch(
        reverse("production-plan-detail", args=(plan.id,)),
        {"actual_quantity": 6},
        format="json",
    )

    plan.refresh_from_db()
    assert response.status_code == 200
    assert plan.actual_unit_material_cost == Decimal("2.0000")
    assert plan.actual_cost_captured_at is not None


@pytest.mark.django_db
def test_inventory_simulates_each_production_day_and_finds_first_shortage(admin_client: APIClient) -> None:
    today = timezone.localdate()
    ingredient = Ingredient.objects.create(name="Daily simulation flour", base_unit="g")
    product = Product.objects.create(code="DAILY-SIMULATION", name_zh="逐日模拟产品", name_en="Daily Simulation")
    recipe = Recipe.objects.create(product=product, yield_quantity=1, is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="配方", position=0)
    RecipeIngredient.objects.create(section=section, ingredient=ingredient, weight="1000", unit="g", position=0)
    for index, (day_offset, quantity) in enumerate(((1, 20), (2, 15), (5, 20), (6, 18))):
        ProductionPlan.objects.create(
            reference=f"PLAN-DAILY-{index}",
            product=product,
            planned_date=today + timedelta(days=day_offset),
            quantity=quantity,
        )
    InventoryItem.objects.create(ingredient=ingredient, quantity="70000", safety_buffer_days=0)

    response = admin_client.get(reverse("inventory-overview"))

    assert response.status_code == 200
    item = response.data["items"][0]
    assert item["demand_14_days"] == "73.000"
    assert item["production_day_count"] == 4
    assert item["average_production_day_demand"] == "18.250"
    assert item["covered_production_days"] == 3
    assert item["shortage_date"] == (today + timedelta(days=6)).isoformat()
    assert [entry["date"] for entry in item["daily_demands"]] == [
        (today + timedelta(days=offset)).isoformat() for offset in (1, 2, 5, 6)
    ]
    assert item["daily_demands"][-1]["remaining_stock"] == "-3.000"
    assert item["daily_demands"][-1]["is_covered"] is False
    assert item["status"] == "WATCH"


@pytest.mark.django_db
def test_inventory_keeps_stocked_ingredient_without_current_recipe_demand(admin_client: APIClient) -> None:
    ingredient = Ingredient.objects.create(name="Discontinued stocked paste", base_unit="g", is_active=False)
    InventoryItem.objects.create(ingredient=ingredient, quantity="8000")

    response = admin_client.get(reverse("inventory-overview"))

    assert response.status_code == 200
    item = response.data["items"][0]
    assert item["ingredient_name"] == "Discontinued stocked paste"
    assert item["current_stock"] == "8.000"
    assert item["demand_14_days"] == "0.000"
    assert item["average_production_day_demand"] is None
    assert item["covered_production_days"] is None
    assert item["shortage_date"] is None
    assert item["status"] == "NO_DEMAND"


@pytest.mark.django_db
def test_historical_plan_is_completed_when_actual_quantity_is_recorded(admin_client: APIClient) -> None:
    product = Product.objects.create(code="HISTORICAL-PRODUCT", name_zh="历史产品", name_en="Historical Product")
    production_date = timezone.localdate() - timedelta(days=1)
    completed = ProductionPlan.objects.create(
        reference="PLAN-HISTORICAL-COMPLETED",
        product=product,
        planned_date=production_date,
        quantity=100,
        actual_quantity=75,
    )

    response = admin_client.get(
        reverse("production-plan-list-create"),
        {"start": production_date.isoformat(), "end": production_date.isoformat()},
    )

    assert response.status_code == 200
    assert response.data["plans"][0]["id"] == str(completed.id)
    assert response.data["plans"][0]["display_status"] == "COMPLETED"
    assert response.data["plans"][0]["difference"] == -25
    assert response.data["plans"][0]["completion_rate"] == 75.0


@pytest.mark.django_db
def test_historical_plan_without_actual_quantity_requires_entry(admin_client: APIClient) -> None:
    product = Product.objects.create(code="MISSING-ACTUAL", name_zh="待补录产品", name_en="Missing Actual")
    production_date = timezone.localdate() - timedelta(days=1)
    ProductionPlan.objects.create(
        reference="PLAN-MISSING-ACTUAL",
        product=product,
        planned_date=production_date,
        quantity=100,
    )

    response = admin_client.get(
        reverse("production-plan-list-create"),
        {"start": production_date.isoformat(), "end": production_date.isoformat()},
    )

    assert response.status_code == 200
    assert response.data["plans"][0]["display_status"] == "MISSING_ACTUAL"


@pytest.mark.django_db
def test_inventory_receipt_accepts_invoice_and_editable_recorder(
    admin_client: APIClient,
    tmp_path,
) -> None:
    ingredient = Ingredient.objects.create(name="Invoice flour", base_unit="g")
    InventoryItem.objects.create(ingredient=ingredient, quantity="10000.000", inventory_value="20.0000")
    supplier = Supplier.objects.create(code="SUP-INVOICE", name="Invoice Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="2.0000",
        currency="GBP",
        price_unit="kg",
        minimum_order_quantity="1",
        minimum_order_unit="kg",
        is_preferred=True,
    )
    recorder = Employee.objects.create(
        employee_number="REC-001",
        name="Receipt Recorder",
        position="Stock controller",
        hourly_rate="14.00",
        employment_type=Employee.EmploymentType.FULL_TIME,
        status=Employee.Status.ACTIVE,
    )
    invoice = SimpleUploadedFile("invoice.pdf", b"%PDF-1.4 test invoice", content_type="application/pdf")

    with override_settings(MEDIA_ROOT=tmp_path):
        response = admin_client.post(
            reverse("inventory-receipt-create"),
            {
                "ingredient_id": str(ingredient.id),
                "supplier_id": str(supplier.id),
                "quantity": "5.000",
                "unit": "kg",
                "unit_price": "2.0000",
                "received_at": "2026-08-22T09:30:00Z",
                "recorded_by_id": str(recorder.id),
                "invoice": invoice,
                "_local_ingredient_name": ingredient.name,
                "_local_supplier_name": supplier.name,
            },
            format="multipart",
        )

        assert response.status_code == 201
        options = admin_client.get(reverse("inventory-receipt-recorder-options"))
        assert options.status_code == 200
        assert options.data == [{
            "id": recorder.id,
            "name": recorder.name,
            "position": recorder.position,
        }]
        assert response.data["recorded_by_id"] == str(recorder.id)
        assert response.data["recorded_by_name"] == recorder.name
        assert "email" not in options.data[0]
        assert response.data["invoice_name"] == "invoice.pdf"
        assert response.data["invoice_size"] == len(b"%PDF-1.4 test invoice")
        assert response.data["invoice_download_url"].endswith("/invoice/")
        receipt = InventoryReceipt.objects.get()
        assert receipt.invoice.name.endswith(".pdf")

        download = admin_client.get(reverse("inventory-receipt-invoice", kwargs={"pk": receipt.id}))
        assert download.status_code == 200
        assert download["Content-Type"] == "application/pdf"


@pytest.mark.django_db
def test_inventory_receipt_update_applies_only_inventory_delta_and_removes_invoice(
    admin_client: APIClient,
    tmp_path,
) -> None:
    ingredient = Ingredient.objects.create(name="Editable flour", base_unit="g")
    inventory = InventoryItem.objects.create(
        ingredient=ingredient,
        quantity="10000.000",
        inventory_value="20.0000",
    )
    supplier = Supplier.objects.create(code="SUP-EDIT", name="Editable Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="2.0000",
        currency="GBP",
        price_unit="kg",
        minimum_order_quantity="1",
        minimum_order_unit="kg",
        is_preferred=True,
    )
    recorder = Employee.objects.create(
        employee_number="REC-002",
        name="New Recorder",
        position="Stock controller",
        hourly_rate="14.00",
        employment_type=Employee.EmploymentType.FULL_TIME,
        status=Employee.Status.ACTIVE,
    )

    with override_settings(MEDIA_ROOT=tmp_path):
        create_response = admin_client.post(
            reverse("inventory-receipt-create"),
            {
                "ingredient_id": str(ingredient.id),
                "supplier_id": str(supplier.id),
                "quantity": "5.000",
                "unit": "kg",
                "unit_price": "2.0000",
                "received_at": "2026-08-22T09:30:00Z",
                "invoice": SimpleUploadedFile("first.png", b"png-data", content_type="image/png"),
            },
            format="multipart",
        )
        receipt_id = create_response.data["id"]
        response = admin_client.patch(
            reverse("inventory-receipt-detail", kwargs={"pk": receipt_id}),
            {
                "supplier_id": str(supplier.id),
                "quantity": "7.000",
                "unit": "kg",
                "unit_price": "3.0000",
                "received_at": "2026-08-22T10:30:00Z",
                "recorded_by_id": str(recorder.id),
                "remove_invoice": "true",
            },
            format="multipart",
        )

        assert response.status_code == 200
        assert response.data["quantity"] == "7.000"
        assert response.data["total_cost"] == "21.00"
        assert response.data["recorded_by_id"] == str(recorder.id)
        assert response.data["invoice_name"] == ""
        assert response.data["invoice_download_url"] is None
        inventory.refresh_from_db()
        assert inventory.quantity == Decimal("17000.000")
        assert inventory.inventory_value == Decimal("41.0000")



@pytest.mark.django_db
def test_inventory_receipts_can_be_bulk_deleted_and_reverse_inventory(
    admin_client: APIClient,
) -> None:
    ingredient = Ingredient.objects.create(name="Bulk delete flour", base_unit="g")
    inventory = InventoryItem.objects.create(
        ingredient=ingredient,
        quantity="10000.000",
        inventory_value="20.0000",
    )
    supplier = Supplier.objects.create(code="SUP-BULK-DELETE", name="Bulk Delete Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="2.0000",
        currency="GBP",
        price_unit="kg",
        minimum_order_quantity="1",
        minimum_order_unit="kg",
        is_preferred=True,
    )
    receipt_ids = []
    for quantity, unit_price in (("5.000", "2.0000"), ("2.000", "3.0000")):
        response = admin_client.post(
            reverse("inventory-receipt-create"),
            {
                "ingredient_id": str(ingredient.id),
                "supplier_id": str(supplier.id),
                "quantity": quantity,
                "unit": "kg",
                "unit_price": unit_price,
                "received_at": "2026-08-22T09:30:00Z",
            },
            format="multipart",
        )
        assert response.status_code == 201
        receipt_ids.append(response.data["id"])

    inventory.refresh_from_db()
    assert inventory.quantity == Decimal("17000.000")
    assert inventory.inventory_value == Decimal("36.0000")

    response = admin_client.post(
        reverse("inventory-receipt-bulk-delete"),
        {"receipt_ids": receipt_ids},
        format="json",
    )

    assert response.status_code == 204
    assert InventoryReceipt.objects.count() == 0
    inventory.refresh_from_db()
    assert inventory.quantity == Decimal("10000.000")
    assert inventory.inventory_value == Decimal("20.0000")


@pytest.mark.django_db
def test_inventory_receipt_delete_is_rejected_when_stock_was_consumed(
    admin_client: APIClient,
) -> None:
    ingredient = Ingredient.objects.create(name="Consumed receipt flour", base_unit="g")
    inventory = InventoryItem.objects.create(
        ingredient=ingredient,
        quantity="0.000",
        inventory_value="0.0000",
    )
    supplier = Supplier.objects.create(code="SUP-CONSUMED-DELETE", name="Consumed Delete Supplier")
    SupplierIngredient.objects.create(
        supplier=supplier,
        ingredient=ingredient,
        unit_price="2.0000",
        currency="GBP",
        price_unit="kg",
        minimum_order_quantity="1",
        minimum_order_unit="kg",
        is_preferred=True,
    )
    create_response = admin_client.post(
        reverse("inventory-receipt-create"),
        {
            "ingredient_id": str(ingredient.id),
            "supplier_id": str(supplier.id),
            "quantity": "5.000",
            "unit": "kg",
            "unit_price": "2.0000",
            "received_at": "2026-08-22T09:30:00Z",
        },
        format="multipart",
    )
    assert create_response.status_code == 201
    consume_inventory(ingredient.id, Decimal("4000.000"))

    response = admin_client.delete(
        reverse("inventory-receipt-detail", kwargs={"pk": create_response.data["id"]})
    )

    assert response.status_code == 400
    assert InventoryReceipt.objects.count() == 1
    inventory.refresh_from_db()
    assert inventory.quantity == Decimal("1000.000")
    assert inventory.inventory_value == Decimal("2.0000")
