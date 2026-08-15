from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Sum
from django.utils import timezone

from bakeops.events.models import BusinessEvent
from bakeops.events.services import event_status
from bakeops.costs.services import daily_estimated_cost
from bakeops.inventory.models import ProductionPlan
from bakeops.inventory.services import build_inventory_snapshot
from bakeops.sales.services import build_sales_analysis


RISK_STATUSES = {"EMERGENCY", "PURCHASE_REQUIRED", "WATCH"}


def build_dashboard_overview(today: date | None = None) -> dict[str, Any]:
    current_date = today or timezone.localdate()
    trend_start = current_date - timedelta(days=6)
    today_sales = build_sales_analysis(current_date, current_date, "day")
    weekly_sales = build_sales_analysis(trend_start, current_date, "day")
    inventory = build_inventory_snapshot(current_date)
    estimated_cost = daily_estimated_cost(current_date)

    production_totals = (
        ProductionPlan.objects.filter(planned_date=current_date)
        .exclude(status=ProductionPlan.Status.CANCELLED)
        .aggregate(planned=Sum("quantity"), actual=Sum("actual_quantity"))
    )

    event_risks = []
    events = (
        BusinessEvent.objects.filter(end_date__gte=current_date)
        .prefetch_related("checklist_items")
        .order_by("start_date", "name")
    )
    for event in events:
        if event_status(event, current_date) != "PREPARATION_RISK":
            continue
        checklist_items = list(event.checklist_items.all())
        event_risks.append(
            {
                "id": str(event.id),
                "name": event.name,
                "start_date": event.start_date.isoformat(),
                "days_until_start": (event.start_date - current_date).days,
                "checklist_completed": sum(item.is_completed for item in checklist_items),
                "checklist_total": len(checklist_items),
            }
        )

    trend_by_date = {item["period"]: item for item in weekly_sales["trend"]}
    sales_trend = []
    for offset in range(7):
        day = trend_start + timedelta(days=offset)
        item = trend_by_date.get(day.isoformat())
        sales_trend.append(
            {
                "date": day.isoformat(),
                "net_sales": item["net_sales"] if item else "0.00",
                "order_count": item["order_count"] if item else 0,
            }
        )

    products = weekly_sales["products"]
    top_products = products[:5]
    total_net_sales = Decimal(weekly_sales["kpis"]["net_sales"])
    sales_mix = []
    for product in top_products:
        product_sales = Decimal(product["net_sales"])
        sales_mix.append(
            {
                "product_id": product["product_id"],
                "product_name_zh": product["product_name_zh"],
                "product_name_en": product["product_name_en"],
                "net_sales": product["net_sales"],
                "share": (
                    f"{product_sales / total_net_sales * Decimal('100'):.1f}"
                    if total_net_sales > 0
                    else "0.0"
                ),
            }
        )
    other_sales = total_net_sales - sum(
        (Decimal(product["net_sales"]) for product in top_products),
        Decimal("0"),
    )
    if other_sales > 0:
        sales_mix.append(
            {
                "product_id": None,
                "product_name_zh": "其他产品",
                "product_name_en": "Other products",
                "net_sales": f"{other_sales:.2f}",
                "share": f"{other_sales / total_net_sales * Decimal('100'):.1f}",
            }
        )

    inventory_risks = [
        {
            "ingredient_id": item["ingredient_id"],
            "ingredient_name": item["ingredient_name"],
            "status": item["status"],
            "current_stock": item["current_stock"],
            "unit": item["unit"],
            "shortage_date": item["shortage_date"],
        }
        for item in inventory["items"]
        if item["status"] in RISK_STATUSES
    ]

    return {
        "generated_at": timezone.now().isoformat(),
        "business_date": current_date.isoformat(),
        "kpis": {
            "today_net_sales": today_sales["kpis"]["net_sales"],
            "today_sales_quantity": today_sales["kpis"]["sales_quantity"],
            "today_order_count": today_sales["kpis"]["order_count"],
            "today_planned_production": production_totals["planned"] or 0,
            "today_actual_production": production_totals["actual"] or 0,
            "daily_estimated_cost": estimated_cost,
            "inventory_risk_count": len(inventory_risks),
            "event_risk_count": len(event_risks),
        },
        "sales_trend": sales_trend,
        "sales_mix": sales_mix,
        "top_products": top_products,
        "inventory_risks": inventory_risks,
        "event_risks": event_risks,
    }
