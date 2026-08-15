from datetime import date, time, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.costs.models import CostItem, MonthlyCost
from bakeops.employees.models import Employee
from bakeops.inventory.models import InventoryItem, ProductionPlan
from bakeops.products.models import Ingredient, Product, Recipe, RecipeIngredient, RecipeSection
from bakeops.scheduling.models import ScheduleEntry
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    user = User.objects.create_superuser(
        username="cost-admin",
        email="cost-admin@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def employee() -> Employee:
    return Employee.objects.create(
        employee_number="COST-001",
        name="Emma",
        date_of_birth="2000-01-01",
        position="Baker",
        hourly_rate="13.50",
        employment_type=Employee.EmploymentType.FULL_TIME,
        email="emma@example.com",
        status=Employee.Status.ACTIVE,
    )


def create_costed_product(unit_cost: str = "3.0000") -> Product:
    product = Product.objects.create(code="MATERIAL-COST", name_zh="物料成本产品", name_en="Material Cost Product")
    recipe = Recipe.objects.create(product=product, yield_quantity=1, is_active=True)
    section = RecipeSection.objects.create(recipe=recipe, name="配方", position=0)
    ingredient = Ingredient.objects.create(name="物料成本食材", base_unit="g")
    RecipeIngredient.objects.create(section=section, ingredient=ingredient, weight="1.000", unit="g", position=0)
    InventoryItem.objects.create(ingredient=ingredient, quantity="100.000", inventory_value=str(Decimal(unit_cost) * 100))
    return product


@pytest.mark.django_db
def test_wages_are_calculated_from_schedule_hours_and_hourly_rate(
    admin_client: APIClient,
    employee: Employee,
) -> None:
    today = timezone.localdate()
    ScheduleEntry.objects.create(
        employee=employee,
        employee_name=employee.name,
        work_date=today,
        start_time=time(8, 0),
        end_time=time(17, 0),
        break_minutes=60,
    )

    response = admin_client.get(reverse("cost-overview"), {"month": today.strftime("%Y-%m")})
    details = admin_client.get(reverse("cost-wage-details"), {"month": today.strftime("%Y-%m")})

    assert response.status_code == 200
    assert response.data["summary"]["employee_wages"] == "108.00"
    assert response.data["wage_entry"]["source"] == "SCHEDULE"
    assert details.data["employees"][0]["actual_hours"] == "8.00"
    assert details.data["employees"][0]["wage"] == "108.00"


@pytest.mark.django_db
def test_deleted_employee_wages_remain_in_historical_costs(
    admin_client: APIClient,
    employee: Employee,
) -> None:
    today = timezone.localdate()
    ScheduleEntry.objects.create(
        employee=employee,
        employee_name=employee.name,
        work_date=today,
        start_time=time(8, 0),
        end_time=time(17, 0),
        break_minutes=60,
    )
    employee.soft_delete()

    overview = admin_client.get(reverse("cost-overview"), {"month": today.strftime("%Y-%m")})
    details = admin_client.get(reverse("cost-wage-details"), {"month": today.strftime("%Y-%m")})

    assert overview.data["summary"]["employee_wages"] == "108.00"
    assert details.data["employees"][0]["is_deleted"] is True


@pytest.mark.django_db
def test_future_schedule_is_not_counted_as_actual_wages(
    admin_client: APIClient,
    employee: Employee,
) -> None:
    future_date = timezone.localdate() + timedelta(days=1)
    ScheduleEntry.objects.create(
        employee=employee,
        employee_name=employee.name,
        work_date=future_date,
        start_time=time(8, 0),
        end_time=time(16, 0),
        break_minutes=0,
    )

    response = admin_client.get(
        reverse("cost-overview"),
        {"month": future_date.strftime("%Y-%m")},
    )

    assert response.data["summary"]["employee_wages"] == "0.00"


@pytest.mark.django_db
def test_material_cost_splices_past_actual_today_remaining_and_future_plans(
    admin_client: APIClient,
) -> None:
    today = timezone.localdate()
    product = create_costed_product("3.0000")
    ProductionPlan.objects.create(
        reference="MATERIAL-PAST",
        product=product,
        planned_date=today - timedelta(days=1),
        quantity=10,
        actual_quantity=8,
        actual_unit_material_cost="2.0000",
    )
    ProductionPlan.objects.create(
        reference="MATERIAL-TODAY",
        product=product,
        planned_date=today,
        quantity=10,
        actual_quantity=4,
        actual_unit_material_cost="2.0000",
    )
    ProductionPlan.objects.create(
        reference="MATERIAL-FUTURE",
        product=product,
        planned_date=today + timedelta(days=1),
        quantity=5,
    )

    overview = admin_client.get(reverse("cost-overview"), {"month": today.strftime("%Y-%m")})
    items = admin_client.get(
        reverse("monthly-cost-batch-update"),
        {"month": today.strftime("%Y-%m")},
    )
    details = admin_client.get(
        reverse("cost-material-details"),
        {"month": today.strftime("%Y-%m")},
    )
    materials = next(item for item in items.data if item["category"] == CostItem.Category.MATERIALS)

    assert overview.status_code == 200
    assert overview.data["summary"]["other_costs"] == "57.00"
    assert overview.data["summary"]["total_cost"] == "57.00"
    assert materials["amount"] == "57.00"
    assert materials["source"] == "PRODUCTION"
    assert materials["is_read_only"] is True
    assert materials["calculation_complete"] is True
    assert details.status_code == 200
    assert details.data["total"] == "57.00"
    assert len(details.data["items"]) == 3
    assert details.data["items"][1]["remaining_planned_quantity"] == 6


@pytest.mark.django_db
def test_historical_material_cost_uses_actual_quantity_and_captured_unit_cost(
    admin_client: APIClient,
) -> None:
    today = timezone.localdate()
    historical_date = today.replace(day=1) - timedelta(days=1)
    product = create_costed_product("9.0000")
    ProductionPlan.objects.create(
        reference="MATERIAL-HISTORY",
        product=product,
        planned_date=historical_date,
        quantity=100,
        actual_quantity=8,
        actual_unit_material_cost="2.0000",
    )

    overview = admin_client.get(
        reverse("cost-overview"),
        {"month": historical_date.strftime("%Y-%m")},
    )

    assert overview.data["summary"]["other_costs"] == "16.00"


@pytest.mark.django_db
def test_material_cost_cannot_be_updated_manually(admin_client: APIClient) -> None:
    today = timezone.localdate()
    items = admin_client.get(
        reverse("monthly-cost-batch-update"),
        {"month": today.strftime("%Y-%m")},
    ).data
    materials = next(item for item in items if item["category"] == CostItem.Category.MATERIALS)

    response = admin_client.put(
        reverse("monthly-cost-batch-update") + f"?month={today:%Y-%m}",
        {"items": [{"monthly_cost": materials["id"], "amount": "999.00"}]},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_manual_cost_crud_and_monthly_summary(admin_client: APIClient) -> None:
    item = CostItem.objects.create(
        name_zh="测试电费",
        name_en="Test Electricity",
        category=CostItem.Category.UTILITIES,
    )
    response = admin_client.post(
        reverse("monthly-cost-list-create") + "?month=2026-07",
        {
            "cost_item": str(item.id),
            "amount": "680.00",
            "incurred_date": "2026-07-08",
            "notes": "Original bill",
        },
        format="json",
    )
    assert response.status_code == 201

    cost_id = response.data["id"]
    update = admin_client.patch(
        reverse("monthly-cost-detail", args=(cost_id,)),
        {"amount": "735.00", "notes": "Corrected bill"},
        format="json",
    )
    overview = admin_client.get(reverse("cost-overview"), {"month": "2026-07"})

    assert update.status_code == 200
    assert overview.data["summary"]["other_costs"] == "735.00"
    assert overview.data["summary"]["total_cost"] == "735.00"

    delete = admin_client.delete(reverse("monthly-cost-detail", args=(cost_id,)))
    assert delete.status_code == 204
    assert not MonthlyCost.objects.filter(id=cost_id).exists()


@pytest.mark.django_db
def test_cost_item_can_be_disabled_and_historical_cost_remains(admin_client: APIClient) -> None:
    item = CostItem.objects.create(
        name_zh="历史保险",
        name_en="Historical Insurance",
        category=CostItem.Category.INSURANCE,
    )
    MonthlyCost.objects.create(cost_item=item, amount="180.00", incurred_date=date(2026, 6, 1))

    response = admin_client.patch(
        reverse("cost-item-detail", args=(item.id,)),
        {"is_active": False},
        format="json",
    )

    assert response.status_code == 200
    assert MonthlyCost.objects.filter(cost_item=item).exists()

    rejected = admin_client.post(
        reverse("monthly-cost-list-create") + "?month=2026-07",
        {
            "cost_item": str(item.id),
            "amount": "25.00",
            "incurred_date": "2026-07-12",
            "notes": "Should not be created",
        },
        format="json",
    )
    assert rejected.status_code == 400


@pytest.mark.django_db
def test_monthly_cost_items_can_be_saved_in_one_batch(admin_client: APIClient) -> None:
    rent = CostItem.objects.create(
        name_zh="批量房租",
        name_en="Batch Rent",
        category=CostItem.Category.RENT,
    )
    electricity = CostItem.objects.create(
        name_zh="批量电费",
        name_en="Batch Electricity",
        category=CostItem.Category.UTILITIES,
    )

    monthly_items = admin_client.get(
        reverse("monthly-cost-batch-update") + "?month=2026-08"
    ).data
    rent_row = next(item for item in monthly_items if str(item["cost_item"]) == str(rent.id))
    electricity_row = next(
        item for item in monthly_items if str(item["cost_item"]) == str(electricity.id)
    )

    created = admin_client.put(
        reverse("monthly-cost-batch-update") + "?month=2026-08",
        {
            "items": [
                {"monthly_cost": rent_row["id"], "amount": "3000.00"},
                {"monthly_cost": electricity_row["id"], "amount": "720.00"},
            ]
        },
        format="json",
    )
    assert created.status_code == 204
    assert MonthlyCost.objects.get(id=rent_row["id"]).amount == 3000
    assert MonthlyCost.objects.get(id=electricity_row["id"]).amount == 720

    updated = admin_client.put(
        reverse("monthly-cost-batch-update") + "?month=2026-08",
        {
            "items": [
                {"monthly_cost": rent_row["id"], "amount": "3100.00"},
                {"monthly_cost": electricity_row["id"], "amount": "0.00"},
            ]
        },
        format="json",
    )

    assert updated.status_code == 204
    assert MonthlyCost.objects.get(id=rent_row["id"]).amount == 3100
    assert MonthlyCost.objects.get(id=electricity_row["id"]).amount == 0


@pytest.mark.django_db
def test_deleting_item_from_one_month_preserves_other_months(admin_client: APIClient) -> None:
    july_items = admin_client.get(
        reverse("monthly-cost-batch-update") + "?month=2026-07"
    ).data
    august_items = admin_client.get(
        reverse("monthly-cost-batch-update") + "?month=2026-08"
    ).data
    july_electricity = next(item for item in july_items if item["name_en"] == "Electricity")
    august_electricity = next(item for item in august_items if item["name_en"] == "Electricity")

    saved = admin_client.put(
        reverse("monthly-cost-batch-update") + "?month=2026-07",
        {"items": [{"monthly_cost": july_electricity["id"], "amount": "735.00"}]},
        format="json",
    )
    deleted = admin_client.delete(
        reverse("monthly-cost-detail", args=(august_electricity["id"],))
    )
    august_reloaded = admin_client.get(
        reverse("monthly-cost-batch-update") + "?month=2026-08"
    ).data

    assert saved.status_code == 204
    assert deleted.status_code == 204
    assert MonthlyCost.objects.get(id=july_electricity["id"]).amount == 735
    assert not any(item["id"] == august_electricity["id"] for item in august_reloaded)


@pytest.mark.django_db
def test_custom_monthly_item_is_not_added_to_other_months(admin_client: APIClient) -> None:
    created = admin_client.post(
        reverse("monthly-cost-batch-update") + "?month=2026-08",
        {
            "name_zh": "八月临时许可",
            "name_en": "August Temporary Permit",
            "category": CostItem.Category.OTHER,
            "notes": "August only",
        },
        format="json",
    )
    september_items = admin_client.get(
        reverse("monthly-cost-batch-update") + "?month=2026-09"
    ).data

    assert created.status_code == 201
    assert created.data["amount"] == "0.00"
    assert not any(item["name_en"] == "August Temporary Permit" for item in september_items)


@pytest.mark.django_db
def test_cost_item_delete_preserves_items_with_history(admin_client: APIClient) -> None:
    unused = CostItem.objects.create(
        name_zh="可删除项目",
        name_en="Deletable Item",
        category=CostItem.Category.OTHER,
    )
    historical = CostItem.objects.create(
        name_zh="历史项目",
        name_en="Historical Item",
        category=CostItem.Category.OTHER,
    )
    MonthlyCost.objects.create(
        cost_item=historical,
        amount="50.00",
        incurred_date=date(2026, 7, 1),
    )

    deleted = admin_client.delete(reverse("cost-item-detail", args=(unused.id,)))
    protected = admin_client.delete(reverse("cost-item-detail", args=(historical.id,)))

    assert deleted.status_code == 204
    assert protected.status_code == 400
    assert CostItem.objects.filter(id=historical.id).exists()
