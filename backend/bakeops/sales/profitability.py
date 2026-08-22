from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.utils import timezone

from bakeops.costs.models import CostItem, MonthlyCost
from bakeops.inventory.models import ProductionPlan
from bakeops.products.costing import current_product_unit_cost
from bakeops.products.models import Product
from bakeops.sales.models import SalesDataRecord
from bakeops.scheduling.models import ScheduleEntry

MONEY_ZERO = Decimal("0.00")


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


def _sales_data(start: date, end: date):
    return SalesDataRecord.objects.filter(sales_date__range=(start, end)).select_related("product")


def _product_costs(
    records: list[SalesDataRecord],
    start: date,
    end: date,
) -> dict[tuple[Any, date], Decimal | None]:
    product_ids = {record.product_id for record in records}
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
        costs[(plan["product_id"], plan["planned_date"])] = (
            plan["actual_unit_material_cost"] or live_costs.get(plan["product_id"])
        )
    for record in records:
        costs.setdefault(
            (record.product_id, record.sales_date),
            live_costs.get(record.product_id),
        )
    return costs


def _daily_manual_costs(start: date, end: date) -> dict[date, Decimal]:
    result: dict[date, Decimal] = defaultdict(Decimal)
    costs = MonthlyCost.objects.filter(
        category__in=[
            category
            for category, _ in CostItem.Category.choices
            if category != CostItem.Category.MATERIALS
        ],
        incurred_date__lte=end,
        cost_month__gte=start.replace(day=1),
        cost_month__lte=end.replace(day=1),
    )
    for cost in costs:
        month_start = cost.cost_month
        month_end = date(
            month_start.year + (month_start.month == 12),
            1 if month_start.month == 12 else month_start.month + 1,
            1,
        ) - timedelta(days=1)
        daily_amount = cost.amount / Decimal((month_end - month_start).days + 1)
        current = max(month_start, start)
        while current <= min(month_end, end):
            result[current] += daily_amount
            current += timedelta(days=1)
    return result


def build_profitability_analysis(start: date, end: date, grain: str) -> dict[str, Any]:
    records = list(_sales_data(start, end))
    today = timezone.localdate()
    product_costs = _product_costs(records, start, end)

    sales_by_day: dict[date, Decimal] = defaultdict(Decimal)
    material_cost_by_day: dict[date, Decimal] = defaultdict(Decimal)
    missing_material_cost_by_day: dict[date, int] = defaultdict(int)
    product_rows: dict[Any, dict[str, Any]] = {}

    for record in records:
        net_sales = record.received_amount - record.refund_amount
        sales_by_day[record.sales_date] += net_sales
        unit_cost = product_costs.get((record.product_id, record.sales_date))
        material_cost = Decimal(record.quantity) * unit_cost if unit_cost is not None else MONEY_ZERO
        if unit_cost is None:
            missing_material_cost_by_day[record.sales_date] += 1
        else:
            material_cost_by_day[record.sales_date] += material_cost

        row = product_rows.setdefault(
            record.product_id,
            {
                "product_id": str(record.product_id),
                "product_name_zh": record.product_name_zh,
                "product_name_en": record.product_name_en,
                "quantity": 0,
                "net_sales": MONEY_ZERO,
                "material_cost": MONEY_ZERO,
                "missing_material_cost_count": 0,
            },
        )
        row["quantity"] += record.quantity
        row["net_sales"] += net_sales
        row["material_cost"] += material_cost
        if unit_cost is None:
            row["missing_material_cost_count"] += 1

    wages_by_day: dict[date, Decimal] = defaultdict(Decimal)
    for entry in ScheduleEntry.objects.filter(
        work_date__range=(start, min(end, today)),
        employee__isnull=False,
    ).select_related("employee"):
        wages_by_day[entry.work_date] += _shift_wage(entry)
    manual_by_day = _daily_manual_costs(start, end)

    total_sales = sum(sales_by_day.values(), MONEY_ZERO)
    total_material = sum(material_cost_by_day.values(), MONEY_ZERO)
    total_missing_material_cost = sum(missing_material_cost_by_day.values())
    total_wages = sum(wages_by_day.values(), MONEY_ZERO)
    total_other = sum(manual_by_day.values(), MONEY_ZERO)
    gross_profit = total_sales - total_material
    operating_profit = gross_profit - total_wages - total_other

    trend_by_period: dict[date, dict[str, Decimal | int]] = defaultdict(
        lambda: {
            "net_sales": MONEY_ZERO,
            "material_cost": MONEY_ZERO,
            "missing_material_cost_count": 0,
            "wages": MONEY_ZERO,
            "other_costs": MONEY_ZERO,
        }
    )
    current = start
    while current <= end:
        row = trend_by_period[_period_start(current, grain)]
        row["net_sales"] += sales_by_day[current]
        row["material_cost"] += material_cost_by_day[current]
        row["missing_material_cost_count"] += missing_material_cost_by_day[current]
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
                "missing_material_cost_count": row["missing_material_cost_count"],
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
                "missing_material_cost_count": row["missing_material_cost_count"],
                "material_cost_complete": row["missing_material_cost_count"] == 0,
                "contribution_profit": f"{contribution:.2f}",
                "contribution_margin": f"{(contribution / row['net_sales'] * Decimal('100')) if row['net_sales'] else Decimal('0'):.1f}",
                "contribution_share": f"{(contribution / gross_profit * Decimal('100')) if gross_profit else Decimal('0'):.1f}",
            }
        )

    sales_median = sorted((Decimal(item["net_sales"]) for item in products))[len(products) // 2] if products else MONEY_ZERO
    margin_median = sorted((Decimal(item["contribution_margin"]) for item in products))[len(products) // 2] if products else MONEY_ZERO
    for item in products:
        high_sales = Decimal(item["net_sales"]) >= sales_median
        high_margin = Decimal(item["contribution_margin"]) >= margin_median
        item["quadrant"] = (
            "STAR"
            if high_sales and high_margin
            else "POTENTIAL"
            if not high_sales and high_margin
            else "TRAFFIC"
            if high_sales
            else "REVIEW"
        )

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "grain": grain},
        "kpis": {
            "net_sales": f"{total_sales:.2f}",
            "material_cost": f"{total_material:.2f}",
            "missing_material_cost_count": total_missing_material_cost,
            "material_cost_complete": total_missing_material_cost == 0,
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
