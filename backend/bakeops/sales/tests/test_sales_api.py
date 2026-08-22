from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.products.models import Product
from bakeops.sales.models import SalesDataRecord, SalesOrder, SalesOrderLine
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
    SalesDataRecord.objects.create(
        sales_date=date(2026, 8, 10),
        channel=SalesDataRecord.Channel.DIRECT,
        product=product,
        product_name_zh=product.name_zh,
        product_name_en=product.name_en,
        quantity=2,
        received_amount="6.00",
        discount_amount="1.00",
        refund_amount="0.50",
    )

    response = admin_client.get(
        reverse("sales-analysis"),
        {"start": "2026-08-10", "end": "2026-08-10", "grain": "day"},
    )

    assert response.status_code == 200
    assert response.data["kpis"] == {
        "net_sales": "5.50",
        "standard_sales": "7.00",
        "sales_quantity": 2,
        "record_count": 1,
        "order_count": 0,
        "average_order_value": "0.00",
        "discount_amount": "1.00",
        "refund_amount": "0.50",
    }
    product_row = response.data["products"][0]
    assert product_row["actual_average_price"] == "2.75"
    assert product_row["standard_unit_price"] == "3.50"
    assert product_row["price_realisation_rate"] == "78.6"
    assert response.data["hourly"] == []
    assert response.data["channels"][0]["channel"] == "DIRECT"


@pytest.mark.django_db
def test_sales_analysis_filters_every_summary_by_channel(admin_client: APIClient) -> None:
    product = Product.objects.create(code="SALES-CHANNEL", name_zh="渠道产品", name_en="Channel Product")
    for channel, received_amount in (
        (SalesDataRecord.Channel.DIRECT, "10.00"),
        (SalesDataRecord.Channel.DELIVERY, "25.00"),
    ):
        SalesDataRecord.objects.create(
            sales_date=date(2026, 8, 10),
            channel=channel,
            product=product,
            product_name_zh=product.name_zh,
            product_name_en=product.name_en,
            quantity=1,
            received_amount=received_amount,
            discount_amount="0.00",
            refund_amount="0.00",
        )

    response = admin_client.get(
        reverse("sales-analysis"),
        {
            "start": "2026-08-10",
            "end": "2026-08-10",
            "grain": "day",
            "channel": SalesDataRecord.Channel.DELIVERY,
        },
    )

    assert response.status_code == 200
    assert response.data["kpis"]["net_sales"] == "25.00"
    assert response.data["kpis"]["sales_quantity"] == 1
    assert response.data["trend"][0]["net_sales"] == "25.00"
    assert response.data["products"][0]["net_sales"] == "25.00"
    assert response.data["channels"] == [
        {
            "channel": SalesDataRecord.Channel.DELIVERY,
            "quantity": 1,
            "standard_sales": "25.00",
            "net_sales": "25.00",
        }
    ]


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
    invalid_channel = admin_client.get(
        reverse("sales-analysis"),
        {"start": today.isoformat(), "end": today.isoformat(), "channel": "UNKNOWN"},
    )

    assert future_response.status_code == 200
    assert future_response.data["range"]["end"] == future.isoformat()
    assert invalid_grain.status_code == 400
    assert invalid_channel.status_code == 400


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


@pytest.mark.django_db
def test_sales_records_can_be_listed_and_updated(admin_client: APIClient) -> None:
    product = Product.objects.create(code="SALES-EDIT", name_zh="编辑产品", name_en="Editable Product")
    order = SalesOrder.objects.create(reference="SALE-EDIT-001", sold_at=timezone.now())
    line = SalesOrderLine.objects.create(
        order=order,
        product=product,
        product_name_zh=product.name_zh,
        product_name_en=product.name_en,
        quantity=2,
        standard_unit_price="3.00",
        standard_sales_amount="6.00",
        discount_amount="0.50",
        paid_amount="5.50",
        refund_amount="0.00",
    )

    list_response = admin_client.get(reverse("sales-record-list"), {"search": "EDIT-001"})
    assert list_response.status_code == 200
    assert list_response.data[0]["id"] == str(line.id)

    update_response = admin_client.put(
        reverse("sales-record-detail", kwargs={"pk": line.id}),
        {
            "reference": "SALE-EDIT-002",
            "sold_at": "2026-08-22T12:30:00+01:00",
            "product_id": str(product.id),
            "quantity": 3,
            "standard_unit_price": "3.50",
            "discount_amount": "0.50",
            "paid_amount": "10.00",
            "refund_amount": "1.00",
        },
        format="json",
    )
    assert update_response.status_code == 200
    assert update_response.data["standard_sales_amount"] == "10.50"
    assert update_response.data["net_sales_amount"] == "9.00"
    order.refresh_from_db()
    assert order.reference == "SALE-EDIT-002"


@pytest.mark.django_db
def test_sales_records_import_and_bulk_delete_are_atomic(admin_client: APIClient) -> None:
    product = Product.objects.create(code="SALES-IMPORT", name_zh="导入产品", name_en="Imported Product")
    import_response = admin_client.post(
        reverse("sales-record-import"),
        {
            "records": [
                {
                    "reference": "SALE-IMPORT-001",
                    "sold_at": "2026-08-22T10:00:00+01:00",
                    "product_id": str(product.id),
                    "quantity": 4,
                    "standard_unit_price": "2.50",
                    "discount_amount": "1.00",
                    "paid_amount": "9.00",
                    "refund_amount": "0.50",
                }
            ]
        },
        format="json",
    )
    assert import_response.status_code == 201
    assert import_response.data["created_count"] == 1
    line_id = import_response.data["records"][0]["id"]

    duplicate_response = admin_client.post(
        reverse("sales-record-import"),
        {
            "records": [
                {
                    "reference": "SALE-IMPORT-001",
                    "sold_at": "2026-08-22T11:00:00+01:00",
                    "product_id": str(product.id),
                    "quantity": 1,
                    "standard_unit_price": "2.50",
                    "discount_amount": "0.00",
                    "paid_amount": "2.50",
                    "refund_amount": "0.00",
                }
            ]
        },
        format="json",
    )
    assert duplicate_response.status_code == 400
    assert SalesOrder.objects.filter(reference="SALE-IMPORT-001").count() == 1

    delete_response = admin_client.post(
        reverse("sales-record-bulk-delete"),
        {"line_ids": [line_id]},
        format="json",
    )
    assert delete_response.status_code == 204
    assert not SalesOrderLine.objects.filter(pk=line_id).exists()
    assert not SalesOrder.objects.filter(reference="SALE-IMPORT-001").exists()


@pytest.mark.django_db
def test_sales_data_import_update_and_bulk_delete(admin_client: APIClient) -> None:
    product = Product.objects.create(code="SALES-DATA", name_zh="汇总产品", name_en="Sales Data Product")
    payload = {
        "sales_date": "2026-08-22",
        "channel": "DIRECT",
        "product_id": str(product.id),
        "quantity": 10,
        "received_amount": "29.00",
        "discount_amount": "1.00",
        "refund_amount": "2.00",
    }

    import_response = admin_client.post(
        reverse("sales-data-import"),
        {"records": [payload]},
        format="json",
    )
    assert import_response.status_code == 201
    record_id = import_response.data["records"][0]["id"]
    assert import_response.data["records"][0]["standard_sales_amount"] == "30.00"
    assert import_response.data["records"][0]["net_sales_amount"] == "27.00"

    duplicate_response = admin_client.post(
        reverse("sales-data-import"),
        {"records": [payload]},
        format="json",
    )
    assert duplicate_response.status_code == 400

    update_response = admin_client.put(
        reverse("sales-data-detail", kwargs={"pk": record_id}),
        {**payload, "channel": "DELIVERY", "received_amount": "31.00"},
        format="json",
    )
    assert update_response.status_code == 200
    assert update_response.data["channel"] == "DELIVERY"
    assert update_response.data["standard_sales_amount"] == "32.00"
    assert update_response.data["net_sales_amount"] == "29.00"

    list_response = admin_client.get(reverse("sales-data-list"), {"channel": "DELIVERY"})
    assert list_response.status_code == 200
    assert [row["id"] for row in list_response.data] == [record_id]

    delete_response = admin_client.post(
        reverse("sales-data-bulk-delete"),
        {"record_ids": [record_id]},
        format="json",
    )
    assert delete_response.status_code == 204
    assert not SalesDataRecord.objects.filter(pk=record_id).exists()


@pytest.mark.django_db
def test_sales_data_rejects_refund_above_received(admin_client: APIClient) -> None:
    product = Product.objects.create(code="SALES-REFUND", name_zh="退款产品", name_en="Refund Product")
    response = admin_client.post(
        reverse("sales-data-import"),
        {
            "records": [{
                "sales_date": "2026-08-22",
                "channel": "CONSIGNMENT",
                "product_id": str(product.id),
                "quantity": 1,
                "received_amount": "2.00",
                "discount_amount": "0.00",
                "refund_amount": "2.01",
            }]
        },
        format="json",
    )
    assert response.status_code == 400
    assert SalesDataRecord.objects.count() == 0


@pytest.mark.django_db
def test_profitability_uses_daily_sales_data(admin_client: APIClient) -> None:
    product = Product.objects.create(
        code="PROFIT-SALES-DATA",
        name_zh="盈利汇总产品",
        name_en="Profit Sales Data Product",
    )
    SalesDataRecord.objects.create(
        sales_date=date(2026, 8, 22),
        channel=SalesDataRecord.Channel.DIRECT,
        product=product,
        product_name_zh=product.name_zh,
        product_name_en=product.name_en,
        quantity=5,
        received_amount="20.00",
        discount_amount="2.00",
        refund_amount="1.50",
    )

    response = admin_client.get(
        reverse("profitability-analysis"),
        {"start": "2026-08-22", "end": "2026-08-22", "grain": "day"},
    )

    assert response.status_code == 200
    assert response.data["kpis"]["net_sales"] == "18.50"
    assert response.data["kpis"]["missing_material_cost_count"] == 1
    assert response.data["kpis"]["material_cost_complete"] is False
    assert response.data["trend"][0]["net_sales"] == "18.50"
    assert response.data["products"][0]["quantity"] == 5
    assert response.data["products"][0]["net_sales"] == "18.50"
    assert response.data["products"][0]["material_cost_complete"] is False
