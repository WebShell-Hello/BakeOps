from datetime import time, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.access.models import Role
from bakeops.costs.models import CostItem, MonthlyCost
from bakeops.employees.models import Employee
from bakeops.events.models import BusinessEvent, EventChecklistItem
from bakeops.inventory.models import ProductionPlan
from bakeops.navigation.models import NavigationItem, NavigationMenu
from bakeops.products.models import Product
from bakeops.sales.models import SalesOrder, SalesOrderLine
from bakeops.scheduling.models import ScheduleEntry
from bakeops.users.models import User


def grant_dashboard_access(user: User) -> None:
    menu = NavigationMenu.objects.create(
        code=f"dashboard-access-{user.id}",
        name_zh="仪表盘权限",
        name_en="Dashboard Access",
    )
    dashboard_page = NavigationItem.objects.create(
        menu=menu,
        item_type=NavigationItem.ItemType.PAGE,
        key="dashboard",
        label_zh="仪表盘",
        label_en="Dashboard",
        frontend_path="/",
        position=0,
    )
    role = Role.objects.create(code=f"dashboard-reader-{user.id}", name=f"Dashboard Reader {user.id}")
    role.pages.set([dashboard_page])
    user.roles.set([role])


@pytest.mark.django_db
def test_dashboard_overview_aggregates_existing_modules() -> None:
    today = timezone.localdate()
    user = User.objects.create_user(
        email="dashboard@example.com",
        username="dashboard",
        password="password123",
    )
    grant_dashboard_access(user)
    client = APIClient()
    client.force_authenticate(user=user)
    product = Product.objects.create(
        code="DASHBOARD-PRODUCT",
        name_zh="仪表盘产品",
        name_en="Dashboard Product",
    )
    ProductionPlan.objects.create(
        reference="DASHBOARD-PLAN",
        product=product,
        planned_date=today,
        quantity=120,
        actual_quantity=90,
        actual_unit_material_cost="2.0000",
    )
    employee = Employee.objects.create(
        employee_number="DASH-001",
        name="Dashboard Baker",
        date_of_birth="1990-01-01",
        position="Baker",
        hourly_rate="10.00",
        employment_type=Employee.EmploymentType.FULL_TIME,
        email="dashboard-baker@example.com",
        status=Employee.Status.ACTIVE,
    )
    ScheduleEntry.objects.create(
        employee=employee,
        employee_name=employee.name,
        work_date=today,
        start_time=time(8, 0),
        end_time=time(16, 0),
    )
    MonthlyCost.objects.create(
        name_zh="仪表盘房租",
        name_en="Dashboard rent",
        category=CostItem.Category.RENT,
        amount="310.00",
        incurred_date=today.replace(day=1),
    )
    BusinessEvent.objects.create(
        name="Dashboard direct cost",
        event_type=BusinessEvent.EventType.OTHER,
        start_date=today,
        end_date=today,
        preparation_days=0,
        estimated_cost="31.00",
    )
    order = SalesOrder.objects.create(reference="DASHBOARD-SALE", sold_at=timezone.now())
    SalesOrderLine.objects.create(
        order=order,
        product=product,
        product_name_zh=product.name_zh,
        product_name_en=product.name_en,
        quantity=10,
        standard_unit_price="3.00",
        standard_sales_amount="30.00",
        discount_amount="2.00",
        paid_amount="28.00",
        refund_amount="1.00",
    )
    event = BusinessEvent.objects.create(
        name="Dashboard risk event",
        event_type=BusinessEvent.EventType.PROMOTION,
        start_date=today + timedelta(days=5),
        end_date=today + timedelta(days=5),
        preparation_days=10,
    )
    for position in range(10):
        EventChecklistItem.objects.create(
            event=event,
            category=EventChecklistItem.Category.MARKETING,
            title_zh=f"事项{position}",
            title_en=f"Task {position}",
            position=position,
        )

    response = client.get(reverse("dashboard-overview"), {"date": today.isoformat()})

    assert response.status_code == 200
    assert response.data["kpis"]["today_net_sales"] == "27.00"
    assert response.data["kpis"]["today_sales_quantity"] == 10
    assert response.data["kpis"]["today_order_count"] == 1
    assert response.data["kpis"]["today_planned_production"] == 120
    assert response.data["kpis"]["today_actual_production"] == 90
    assert response.data["kpis"]["inventory_risk_count"] == 0
    assert response.data["kpis"]["event_risk_count"] == 1
    assert response.data["kpis"]["daily_estimated_cost"] == {
        "total": "301.00",
        "material_cost": "180.00",
        "labour_cost": "80.00",
        "allocated_operating_cost": "10.00",
        "direct_daily_cost": "31.00",
        "planned_business_days": 31,
        "production_source": "ACTUAL",
        "labour_source": "ACTUAL",
        "calculation_complete": True,
        "missing_cost_count": 0,
    }
    assert len(response.data["sales_trend"]) == 7
    assert response.data["top_products"][0]["product_name_en"] == "Dashboard Product"
    assert response.data["event_risks"][0]["name"] == "Dashboard risk event"


@pytest.mark.django_db
def test_dashboard_overview_requires_authentication() -> None:
    response = APIClient().get(reverse("dashboard-overview"))

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_dashboard_overview_allows_configured_anonymous_user_role() -> None:
    menu = NavigationMenu.objects.create(code="anonymous-dashboard-test", name_zh="匿名仪表盘", name_en="Anonymous")
    dashboard_page = NavigationItem.objects.create(
        menu=menu,
        item_type=NavigationItem.ItemType.PAGE,
        key="dashboard",
        label_zh="仪表盘",
        label_en="Dashboard",
        frontend_path="/",
        position=0,
    )
    role = Role.objects.get(code=Role.ANONYMOUS_ROLE_CODE)
    role.anonymous_access_mode = Role.AnonymousAccessMode.SYSTEM_PAGE
    role.save(update_fields=("anonymous_access_mode", "updated_at"))
    role.pages.set([dashboard_page])

    response = APIClient().get(reverse("dashboard-overview"))

    assert response.status_code == 200
    assert "kpis" in response.data


@pytest.mark.django_db
def test_dashboard_overview_rejects_invalid_date() -> None:
    user = User.objects.create_user(email="dashboard-date@example.com", password="password123")
    grant_dashboard_access(user)
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(reverse("dashboard-overview"), {"date": "15-08-2026"})

    assert response.status_code == 400
    assert "date" in response.data
