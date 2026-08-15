from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Count, F, Sum
from django.utils import timezone

from bakeops.costs.models import CostItem, MonthlyCost
from bakeops.inventory.models import ProductionPlan
from bakeops.products.costing import current_product_unit_cost
from bakeops.products.models import Product
from bakeops.sales.models import SalesOrderLine
from bakeops.scheduling.models import ScheduleEntry

MONEY_ZERO = Decimal("0.00")


def _money(value: Decimal | None) -> Decimal:
    return value or MONEY_ZERO


def _shift_minutes(entry: ScheduleEntry) -> int:
    start = entry.start_time.hour * 60 + entry.start_time.minute
    end = entry.end_time.hour * 60 + entry.end_time.minute
    return max(end - start - entry.break_minutes, 0)


def _shift_wage(entry: ScheduleEntry) -> Decimal:
    if entry.employee is None:
        return MONEY_ZERO
    return (entry.employee.hourly_rate * Decimal(_shift_minutes(entry)) / Decimal("60")).quantize(
        Decimal("0.01")
    )


def _period_start(value: date, grain: str) -> date:
    if grain == "week":
        return value - timedelta(days=value.weekday())
    if grain == "month":
        return value.replace(day=1)
    return value


def _sales_lines(start: date, end: date):
    current_timezone = timezone.get_current_timezone()
    start_at = timezone.make_aware(datetime.combine(start, time.min), current_timezone)
    end_at = timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min), current_timezone)
    return SalesOrderLine.objects.filter(
        order__sold_at__gte=start_at,
        order__sold_at__lt=end_at,
    ).select_related("order", "product")


def _product_costs(lines: list[SalesOrderLine], start: date, end: date) -> dict[tuple[Any, date], Decimal | None]:
    product_ids = {line.product_id for line in lines}
    live_costs = {
        product.id: current_product_unit_cost(product)
        for product in Product.objects.filter(id__in=product_ids)
    }
    plans = ProductionPlan.objects.filter(
        product_id__in=product_ids,
        planned_date__range=(start, end),
        actual_quantity__gt=0,
    ).values("product_id", "planned_date", "actual_unit_material_cost")
    costs: dict[tuple[Any, date], Decimal | None] = {}
    for plan in plans:
        costs[(plan["product_id"], plan["planned_date"])] = plan["actual_unit_material_cost"] or live_costs.get(
            plan["product_id"]
        )
    for line in lines:
        sold_date = timezone.localtime(line.order.sold_at).date()
        costs.setdefault((line.product_id, sold_date), live_costs.get(line.product_id))
    return costs


def _daily_manual_costs(start: date, end: date) -> dict[date, Decimal]:
    result: dict[date, Decimal] = defaultdict(Decimal)
    costs = MonthlyCost.objects.filter(
        category__in=[category for category, _ in CostItem.Category.choices if category != CostItem.Category.MATERIALS],
        incurred_date__lte=end,
        cost_month__gte=start.replace(day=1),
        cost_month__lte=end.replace(day=1),
    )
    for cost in costs:
        month_start = cost.cost_month
        month_end = date(month_start.year + (month_start.month == 12), 1 if month_start.month == 12 else month_start.month + 1, 1) - timedelta(days=1)
        days = (month_end - month_start).days + 1
        daily_amount = cost.amount / Decimal(days)
        current = max(month_start, start)
        while current <= min(month_end, end):
            result[current] += daily_amount
            current += timedelta(days=1)
    return result


def build_profitability_analysis(start: date, end: date, grain: str) -> dict[str, Any]:
    lines = list(_sales_lines(start, end))
    today = timezone.localdate()
    material_cost_by_day: dict[date, Decimal] = defaultdict(Decimal)
    production = ProductionPlan.objects.filter(
        planned_date__range=(start, min(end, today)),
        actual_quantity__gt=0,
    ).values("planned_date", "actual_quantity", "product_id", "actual_unit_material_cost")
    product_ids = {row["product_id"] for row in production}
    product_ids.update(line.product_id for line in lines)
    live_costs = {
        product.id: current_product_unit_cost(product)
        for product in Product.objects.filter(id__in=product_ids)
    }
    for row in production:
        unit_cost = row["actual_unit_material_cost"] or live_costs.get(row["product_id"])
        if unit_cost is not None:
            material_cost_by_day[row["planned_date"]] += Decimal(row["actual_quantity"]) * unit_cost

    wages_by_day: dict[date, Decimal] = defaultdict(Decimal)
    for entry in ScheduleEntry.objects.filter(
        work_date__range=(start, min(end, today)),
        employee__isnull=False,
    ).select_related("employee"):
        wages_by_day[entry.work_date] += _shift_wage(entry)
    manual_by_day = _daily_manual_costs(start, end)

    sales_by_day: dict[date, dict[str, Decimal | int]] = defaultdict(
        lambda: {"net_sales": MONEY_ZERO, "quantity": 0, "orders": 0}
    )
    order_days: dict[date, set[Any]] = defaultdict(set)
    for line in lines:
        sold_date = timezone.localtime(line.order.sold_at).date()
        current = sales_by_day[sold_date]
        current["net_sales"] += line.paid_amount - line.refund_amount
        current["quantity"] += line.quantity
        order_days[sold_date].add(line.order_id)
    for day, order_ids in order_days.items():
        sales_by_day[day]["orders"] = len(order_ids)

    product_costs = _product_costs(lines, start, end)
    product_rows: dict[Any, dict[str, Any]] = {}
    for line in lines:
        sold_date = timezone.localtime(line.order.sold_at).date()
        row = product_rows.setdefault(
            line.product_id,
            {
                "product_id": str(line.product_id),
                "product_name_zh": line.product_name_zh,
                "product_name_en": line.product_name_en,
                "quantity": 0,
                "net_sales": MONEY_ZERO,
                "material_cost": MONEY_ZERO,
            },
        )
        unit_cost = product_costs.get((line.product_id, sold_date))
        row["quantity"] += line.quantity
        row["net_sales"] += line.paid_amount - line.refund_amount
        if unit_cost is not None:
            row["material_cost"] += Decimal(line.quantity) * unit_cost

    total_sales = sum((value["net_sales"] for value in sales_by_day.values()), MONEY_ZERO)
    total_material = sum(material_cost_by_day.values(), MONEY_ZERO)
    total_wages = sum(wages_by_day.values(), MONEY_ZERO)
    total_other = sum(manual_by_day.values(), MONEY_ZERO)
    total_cost = total_material + total_wages + total_other
    gross_profit = total_sales - total_material
    operating_profit = total_sales - total_cost

    trend_by_period: dict[date, dict[str, Decimal | int]] = defaultdict(
        lambda: {"net_sales": MONEY_ZERO, "material_cost": MONEY_ZERO, "wages": MONEY_ZERO, "other_costs": MONEY_ZERO}
    )
    current = start
    while current <= end:
        period = _period_start(current, grain)
        row = trend_by_period[period]
        row["net_sales"] += sales_by_day[current]["net_sales"]
        row["material_cost"] += material_cost_by_day[current]
        row["wages"] += wages_by_day[current]
        row["other_costs"] += manual_by_day[current]
        current += timedelta(days=1)
    trend = []
    for period in sorted(trend_by_period):
        row = trend_by_period[period]
        gross = row["net_sales"] - row["material_cost"]
        operating = gross - row["wages"] - row["other_costs"]
        trend.append(
            {
                "period": period.isoformat(),
                "net_sales": f"{row['net_sales']:.2f}",
                "material_cost": f"{row['material_cost']:.2f}",
                "gross_profit": f"{gross:.2f}",
                "wages": f"{row['wages']:.2f}",
                "other_costs": f"{row['other_costs']:.2f}",
                "operating_profit": f"{operating:.2f}",
            }
        )

    products = []
    for row in sorted(product_rows.values(), key=lambda item: item["net_sales"], reverse=True):
        contribution = row["net_sales"] - row["material_cost"]
        products.append(
            {
                "product_id": row["product_id"],
                "product_name_zh": row["product_name_zh"],
                "product_name_en": row["product_name_en"],
                "quantity": row["quantity"],
                "net_sales": f"{row['net_sales']:.2f}",
                "material_cost": f"{row['material_cost']:.2f}",
                "contribution_profit": f"{contribution:.2f}",
                "contribution_margin": f"{(contribution / row['net_sales'] * Decimal('100')) if row['net_sales'] else Decimal('0'):.1f}",
                "contribution_share": f"{(contribution / gross_profit * Decimal('100')) if gross_profit else Decimal('0'):.1f}",
            }
        )

    sales_median = sorted((Decimal(item["net_sales"]) for item in products))[len(products) // 2] if products else Decimal("0")
    margin_median = sorted((Decimal(item["contribution_margin"]) for item in products))[len(products) // 2] if products else Decimal("0")
    for item in products:
        high_sales = Decimal(item["net_sales"]) >= sales_median
        high_margin = Decimal(item["contribution_margin"]) >= margin_median
        item["quadrant"] = "STAR" if high_sales and high_margin else "POTENTIAL" if not high_sales and high_margin else "TRAFFIC" if high_sales else "REVIEW"

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "grain": grain},
        "kpis": {
            "net_sales": f"{total_sales:.2f}",
            "material_cost": f"{total_material:.2f}",
            "gross_profit": f"{gross_profit:.2f}",
            "gross_margin": f"{(gross_profit / total_sales * Decimal('100')) if total_sales else Decimal('0'):.1f}",
            "wages": f"{total_wages:.2f}",
            "other_costs": f"{total_other:.2f}",
            "operating_profit": f"{operating_profit:.2f}",
            "operating_margin": f"{(operating_profit / total_sales * Decimal('100')) if total_sales else Decimal('0'):.1f}",
        },
        "cost_structure": [
            {"key": "MATERIALS", "amount": f"{total_material:.2f}"},
            {"key": "WAGES", "amount": f"{total_wages:.2f}"},
            {"key": "OTHER", "amount": f"{total_other:.2f}"},
        ],
        "trend": trend,
        "products": products,
    }
