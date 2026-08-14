from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import ExtractHour, TruncDay, TruncMonth, TruncWeek
from django.utils import timezone

from bakeops.sales.models import SalesOrderLine

MONEY_ZERO = Decimal("0.00")
NET_SALES_EXPRESSION = ExpressionWrapper(
    F("paid_amount") - F("refund_amount"),
    output_field=DecimalField(max_digits=12, decimal_places=2),
)


def sales_lines(start: date, end: date):
    timezone_info = timezone.get_current_timezone()
    start_at = timezone.make_aware(datetime.combine(start, time.min), timezone_info)
    end_at = timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min), timezone_info)
    return SalesOrderLine.objects.filter(
        order__sold_at__gte=start_at,
        order__sold_at__lt=end_at,
    )


def decimal_value(value: Decimal | None) -> Decimal:
    return value or MONEY_ZERO


def percentage(numerator: Decimal, denominator: Decimal) -> str:
    if denominator <= 0:
        return "0.0"
    return f"{numerator / denominator * Decimal('100'):.1f}"


def build_sales_analysis(start: date, end: date, grain: str) -> dict[str, Any]:
    lines = sales_lines(start, end)
    totals = lines.aggregate(
        net_sales=Sum(NET_SALES_EXPRESSION),
        quantity=Sum("quantity"),
        order_count=Count("order_id", distinct=True),
        discount=Sum("discount_amount"),
        refunds=Sum("refund_amount"),
    )
    net_sales = decimal_value(totals["net_sales"])
    order_count = totals["order_count"] or 0
    average_order_value = net_sales / Decimal(order_count) if order_count else MONEY_ZERO

    truncation = {
        "day": TruncDay("order__sold_at", tzinfo=timezone.get_current_timezone()),
        "week": TruncWeek("order__sold_at", tzinfo=timezone.get_current_timezone()),
        "month": TruncMonth("order__sold_at", tzinfo=timezone.get_current_timezone()),
    }[grain]
    trend = []
    for row in (
        lines.annotate(period=truncation)
        .values("period")
        .annotate(
            net_sales=Sum(NET_SALES_EXPRESSION),
            standard_sales=Sum("standard_sales_amount"),
            discount=Sum("discount_amount"),
            refunds=Sum("refund_amount"),
            quantity=Sum("quantity"),
            order_count=Count("order_id", distinct=True),
        )
        .order_by("period")
    ):
        trend.append(
            {
                "period": row["period"].date().isoformat(),
                "net_sales": f"{decimal_value(row['net_sales']):.2f}",
                "standard_sales": f"{decimal_value(row['standard_sales']):.2f}",
                "discount": f"{decimal_value(row['discount']):.2f}",
                "refunds": f"{decimal_value(row['refunds']):.2f}",
                "quantity": row["quantity"] or 0,
                "order_count": row["order_count"] or 0,
            }
        )

    products = []
    product_rows = (
        lines.values("product_id", "product_name_zh", "product_name_en")
        .annotate(
            quantity=Sum("quantity"),
            standard_sales=Sum("standard_sales_amount"),
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

    hourly = []
    for row in (
        lines.annotate(hour=ExtractHour("order__sold_at", tzinfo=timezone.get_current_timezone()))
        .values("hour")
        .annotate(
            net_sales=Sum(NET_SALES_EXPRESSION),
            quantity=Sum("quantity"),
            order_count=Count("order_id", distinct=True),
        )
        .order_by("hour")
    ):
        hourly.append(
            {
                "hour": row["hour"],
                "net_sales": f"{decimal_value(row['net_sales']):.2f}",
                "quantity": row["quantity"] or 0,
                "order_count": row["order_count"] or 0,
            }
        )

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "grain": grain},
        "kpis": {
            "net_sales": f"{net_sales:.2f}",
            "sales_quantity": totals["quantity"] or 0,
            "order_count": order_count,
            "average_order_value": f"{average_order_value:.2f}",
            "discount_amount": f"{decimal_value(totals['discount']):.2f}",
            "refund_amount": f"{decimal_value(totals['refunds']):.2f}",
        },
        "trend": trend,
        "products": products,
        "hourly": hourly,
    }
