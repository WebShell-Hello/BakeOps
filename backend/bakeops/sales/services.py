from datetime import date, datetime
from decimal import Decimal
from typing import Any

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek

from bakeops.sales.models import SalesDataRecord

MONEY_ZERO = Decimal("0.00")
STANDARD_SALES_EXPRESSION = ExpressionWrapper(
    F("received_amount") + F("discount_amount"),
    output_field=DecimalField(max_digits=12, decimal_places=2),
)
NET_SALES_EXPRESSION = ExpressionWrapper(
    F("received_amount") - F("refund_amount"),
    output_field=DecimalField(max_digits=12, decimal_places=2),
)


def decimal_value(value: Decimal | None) -> Decimal:
    return value or MONEY_ZERO


def percentage(numerator: Decimal, denominator: Decimal) -> str:
    if denominator <= 0:
        return "0.0"
    return f"{numerator / denominator * Decimal('100'):.1f}"


def period_value(value: date | datetime) -> str:
    return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()


def build_sales_analysis(
    start: date,
    end: date,
    grain: str,
    channel: str | None = None,
) -> dict[str, Any]:
    records = SalesDataRecord.objects.filter(sales_date__range=(start, end))
    if channel:
        records = records.filter(channel=channel)
    totals = records.aggregate(
        net_sales=Sum(NET_SALES_EXPRESSION),
        standard_sales=Sum(STANDARD_SALES_EXPRESSION),
        quantity=Sum("quantity"),
        record_count=Count("id"),
        discount=Sum("discount_amount"),
        refunds=Sum("refund_amount"),
    )
    net_sales = decimal_value(totals["net_sales"])

    truncation = {
        "day": TruncDay("sales_date"),
        "week": TruncWeek("sales_date"),
        "month": TruncMonth("sales_date"),
    }[grain]
    trend = []
    for row in (
        records.annotate(period=truncation)
        .values("period")
        .annotate(
            net_sales=Sum(NET_SALES_EXPRESSION),
            standard_sales=Sum(STANDARD_SALES_EXPRESSION),
            discount=Sum("discount_amount"),
            refunds=Sum("refund_amount"),
            quantity=Sum("quantity"),
            record_count=Count("id"),
        )
        .order_by("period")
    ):
        trend.append(
            {
                "period": period_value(row["period"]),
                "net_sales": f"{decimal_value(row['net_sales']):.2f}",
                "standard_sales": f"{decimal_value(row['standard_sales']):.2f}",
                "discount": f"{decimal_value(row['discount']):.2f}",
                "refunds": f"{decimal_value(row['refunds']):.2f}",
                "quantity": row["quantity"] or 0,
                "record_count": row["record_count"] or 0,
                "order_count": 0,
            }
        )

    products = []
    product_rows = (
        records.values("product_id", "product_name_zh", "product_name_en")
        .annotate(
            quantity=Sum("quantity"),
            standard_sales=Sum(STANDARD_SALES_EXPRESSION),
            discount=Sum("discount_amount"),
            refunds=Sum("refund_amount"),
            net_sales=Sum(NET_SALES_EXPRESSION),
        )
        .order_by("-net_sales", "product_name_en")
    )
    for row in product_rows:
        quantity = row["quantity"] or 0
        standard_sales = decimal_value(row["standard_sales"])
        product_net_sales = decimal_value(row["net_sales"])
        products.append(
            {
                "product_id": str(row["product_id"]),
                "product_name_zh": row["product_name_zh"],
                "product_name_en": row["product_name_en"],
                "quantity": quantity,
                "standard_sales": f"{standard_sales:.2f}",
                "discount": f"{decimal_value(row['discount']):.2f}",
                "refunds": f"{decimal_value(row['refunds']):.2f}",
                "net_sales": f"{product_net_sales:.2f}",
                "standard_unit_price": f"{standard_sales / Decimal(quantity):.2f}" if quantity else "0.00",
                "actual_average_price": f"{product_net_sales / Decimal(quantity):.2f}" if quantity else "0.00",
                "price_realisation_rate": percentage(product_net_sales, standard_sales),
            }
        )

    channels = []
    for row in (
        records.values("channel")
        .annotate(
            quantity=Sum("quantity"),
            standard_sales=Sum(STANDARD_SALES_EXPRESSION),
            net_sales=Sum(NET_SALES_EXPRESSION),
        )
        .order_by("channel")
    ):
        channels.append(
            {
                "channel": row["channel"],
                "quantity": row["quantity"] or 0,
                "standard_sales": f"{decimal_value(row['standard_sales']):.2f}",
                "net_sales": f"{decimal_value(row['net_sales']):.2f}",
            }
        )

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "grain": grain},
        "kpis": {
            "net_sales": f"{net_sales:.2f}",
            "standard_sales": f"{decimal_value(totals['standard_sales']):.2f}",
            "sales_quantity": totals["quantity"] or 0,
            "record_count": totals["record_count"] or 0,
            "order_count": 0,
            "average_order_value": "0.00",
            "discount_amount": f"{decimal_value(totals['discount']):.2f}",
            "refund_amount": f"{decimal_value(totals['refunds']):.2f}",
        },
        "trend": trend,
        "products": products,
        "channels": channels,
        "hourly": [],
    }
