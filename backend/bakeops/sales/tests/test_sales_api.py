from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.products.models import Product
from bakeops.sales.models import SalesOrder, SalesOrderLine
from bakeops.sales.views import six_month_window_start
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    user = User.objects.create_superuser(
        username="sales-admin",
        email="sales-admin@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_sales_analysis_uses_actual_paid_amount_minus_refunds(admin_client: APIClient) -> None:
    product = Product.objects.create(code="SALES-A", name_zh="销售产品", name_en="Sales Product")
    sold_at = timezone.make_aware(datetime(2026, 8, 10, 9, 30))
    order = SalesOrder.objects.create(reference="SALE-001", sold_at=sold_at)
    SalesOrderLine.objects.create(
        order=order,
        product=product,
        product_name_zh=product.name_zh,
        product_name_en=product.name_en,
        quantity=2,
        standard_unit_price="3.50",
        standard_sales_amount="7.00",
        discount_amount="1.00",
        paid_amount="6.00",
        refund_amount="0.50",
    )

    response = admin_client.get(
        reverse("sales-analysis"),
        {"start": "2026-08-10", "end": "2026-08-10", "grain": "day"},
    )

    assert response.status_code == 200
    assert response.data["kpis"] == {
        "net_sales": "5.50",
        "sales_quantity": 2,
        "order_count": 1,
        "average_order_value": "5.50",
        "discount_amount": "1.00",
        "refund_amount": "0.50",
    }
    product_row = response.data["products"][0]
    assert product_row["actual_average_price"] == "2.75"
    assert product_row["standard_unit_price"] == "3.50"
    assert product_row["price_realisation_rate"] == "78.6"
    assert response.data["hourly"][0]["hour"] == 9


@pytest.mark.django_db
def test_sales_analysis_rejects_future_and_invalid_ranges(admin_client: APIClient) -> None:
    today = timezone.localdate()
    future = today + timedelta(days=1)

    future_response = admin_client.get(
        reverse("sales-analysis"),
        {"start": today.isoformat(), "end": future.isoformat()},
    )
    invalid_grain = admin_client.get(
        reverse("sales-analysis"),
        {"start": today.isoformat(), "end": today.isoformat(), "grain": "quarter"},
    )

    assert future_response.status_code == 200
    assert future_response.data["range"]["end"] == future.isoformat()
    assert invalid_grain.status_code == 400


@pytest.mark.django_db
def test_sales_line_constraints_keep_discounts_and_refunds_bounded() -> None:
    product = Product.objects.create(code="SALES-CONSTRAINT", name_zh="约束产品", name_en="Constraint Product")
    order = SalesOrder.objects.create(reference="SALE-CONSTRAINT", sold_at=timezone.now())
    line = SalesOrderLine.objects.create(
        order=order,
        product=product,
        product_name_zh=product.name_zh,
        product_name_en=product.name_en,
        quantity=1,
        standard_unit_price="3.50",
        standard_sales_amount="3.50",
        discount_amount="0.50",
        paid_amount="3.00",
        refund_amount="0.25",
    )

    assert line.net_sales_amount == Decimal("2.75")


def test_sales_default_window_starts_at_the_first_day_of_the_sixth_month() -> None:
    assert six_month_window_start(datetime(2026, 8, 14).date()).isoformat() == "2026-03-01"
