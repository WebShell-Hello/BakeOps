from collections import defaultdict
from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.db import transaction
from django.db.models import Prefetch, QuerySet
from django.utils import timezone

from bakeops.inventory.models import ProductionPlan
from bakeops.products.costing import current_recipe_unit_cost
from bakeops.products.models import Recipe, RecipeIngredient, RecipeSection
from bakeops.scheduling.models import ScheduleEntry

PENNY = Decimal("0.01")


def parse_month(value: str | None) -> date:
    if not value:
        raise ValueError("month is required in YYYY-MM format.")
    try:
        return datetime.strptime(value, "%Y-%m").date().replace(day=1)
    except ValueError as error:
        raise ValueError("month must use YYYY-MM format.") from error


def next_month(month: date) -> date:
    return date(month.year + (month.month == 12), 1 if month.month == 12 else month.month + 1, 1)


@transaction.atomic
def ensure_cost_month(month: date) -> None:
    from bakeops.costs.models import CostItem, CostMonth, MonthlyCost

    _, created = CostMonth.objects.get_or_create(month=month)
    if not created:
        return

    existing_template_ids = set(
        MonthlyCost.objects.filter(cost_month=month, cost_item__isnull=False).values_list(
            "cost_item_id", flat=True
        )
    )
    templates = CostItem.objects.filter(is_active=True).exclude(id__in=existing_template_ids)
    MonthlyCost.objects.bulk_create(
        [
            MonthlyCost(
                cost_item=item,
                name_zh=item.name_zh,
                name_en=item.name_en,
                category=item.category,
                amount=Decimal("0.00"),
                incurred_date=month,
                cost_month=month,
                notes=item.notes,
            )
            for item in templates
        ]
    )


def monthly_schedule_entries(month: date) -> QuerySet[ScheduleEntry]:
    end = min(next_month(month), timezone.localdate() + date.resolution)
    return ScheduleEntry.objects.filter(
        work_date__gte=month,
        work_date__lt=end,
        employee__isnull=False,
    ).select_related("employee")


def shift_minutes(entry: ScheduleEntry) -> int:
    total = (entry.end_time.hour * 60 + entry.end_time.minute) - (
        entry.start_time.hour * 60 + entry.start_time.minute
    )
    return max(total - entry.break_minutes, 0)


def shift_wage(entry: ScheduleEntry) -> Decimal:
    if entry.employee is None:
        return Decimal("0.00")
    return (entry.employee.hourly_rate * Decimal(shift_minutes(entry)) / Decimal(60)).quantize(
        PENNY,
        rounding=ROUND_HALF_UP,
    )


def wage_summary(month: date) -> dict[str, Any]:
    employees: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"actual_minutes": 0, "shift_count": 0, "wage": Decimal("0.00")}
    )
    total = Decimal("0.00")
    for entry in monthly_schedule_entries(month):
        if entry.employee is None:
            continue
        key = str(entry.employee_id)
        detail = employees[key]
        detail.update(
            {
                "employee_id": key,
                "employee_name": entry.employee_name,
                "position": entry.employee.position,
                "hourly_rate": f"{entry.employee.hourly_rate:.2f}",
                "is_deleted": entry.employee.deleted_at is not None,
            }
        )
        detail["actual_minutes"] += shift_minutes(entry)
        detail["shift_count"] += 1
        wage = shift_wage(entry)
        detail["wage"] += wage
        total += wage

    details = []
    for detail in employees.values():
        details.append(
            {
                **detail,
                "actual_hours": f"{Decimal(detail['actual_minutes']) / Decimal(60):.2f}",
                "wage": f"{detail['wage']:.2f}",
            }
        )
    details.sort(key=lambda item: item["employee_name"])
    return {"total": total.quantize(PENNY), "employees": details}


def _production_plans_for_month(month: date) -> QuerySet[ProductionPlan]:
    items = RecipeIngredient.objects.select_related(
        "ingredient",
        "ingredient__inventory_item",
    ).order_by("position")
    sections = RecipeSection.objects.order_by("position").prefetch_related(
        Prefetch("items", queryset=items)
    )
    active_recipes = Recipe.objects.filter(is_active=True).prefetch_related(
        Prefetch("sections", queryset=sections)
    )
    return (
        ProductionPlan.objects.filter(
            planned_date__gte=month,
            planned_date__lt=next_month(month),
        )
        .exclude(status=ProductionPlan.Status.CANCELLED)
        .select_related("product")
        .prefetch_related(
            Prefetch("product__recipes", queryset=active_recipes, to_attr="active_recipe_cache")
        )
    )


def production_material_cost_summary(
    month: date,
    today: date | None = None,
) -> dict[str, Any]:
    boundary = today or timezone.localdate()
    total = Decimal("0")
    actual_total = Decimal("0")
    planned_total = Decimal("0")
    actual_quantity = 0
    planned_quantity = 0
    missing_plan_ids: set[str] = set()
    live_costs: dict[Any, Decimal | None] = {}

    def live_unit_cost(plan: ProductionPlan) -> Decimal | None:
        if plan.product_id in live_costs:
            return live_costs[plan.product_id]
        recipes = getattr(plan.product, "active_recipe_cache", [])
        if not recipes:
            live_costs[plan.product_id] = None
            return None
        cost = current_recipe_unit_cost(recipes[0])
        live_costs[plan.product_id] = cost
        return cost

    def add_cost(plan: ProductionPlan, quantity: int, unit_cost: Decimal | None, source: str) -> None:
        nonlocal total, actual_total, planned_total, actual_quantity, planned_quantity
        if quantity <= 0:
            return
        if unit_cost is None:
            missing_plan_ids.add(str(plan.id))
            return
        amount = Decimal(quantity) * unit_cost
        total += amount
        if source == "actual":
            actual_total += amount
            actual_quantity += quantity
        else:
            planned_total += amount
            planned_quantity += quantity

    for plan in _production_plans_for_month(month):
        actual = plan.actual_quantity or 0
        if plan.planned_date < boundary:
            add_cost(plan, actual, plan.actual_unit_material_cost, "actual")
            continue
        if plan.planned_date == boundary:
            actual_unit_cost = plan.actual_unit_material_cost or live_unit_cost(plan)
            add_cost(plan, actual, actual_unit_cost, "actual")
            add_cost(plan, max(plan.quantity - actual, 0), live_unit_cost(plan), "planned")
            continue
        add_cost(plan, plan.quantity, live_unit_cost(plan), "planned")

    return {
        "total": total.quantize(PENNY, rounding=ROUND_HALF_UP),
        "actual_total": actual_total.quantize(PENNY, rounding=ROUND_HALF_UP),
        "planned_total": planned_total.quantize(PENNY, rounding=ROUND_HALF_UP),
        "actual_quantity": actual_quantity,
        "planned_quantity": planned_quantity,
        "is_complete": not missing_plan_ids,
        "missing_cost_count": len(missing_plan_ids),
    }


def daily_estimated_cost(target_date: date) -> dict[str, Any]:
    """Estimate one operating day's cost from production, schedules and monthly costs."""
    from bakeops.costs.models import CostItem, MonthlyCost
    from bakeops.events.models import BusinessClosure, BusinessEvent

    month = target_date.replace(day=1)
    plans = _production_plans_for_month(month).filter(planned_date=target_date)
    material_cost = Decimal("0")
    missing_cost_count = 0
    used_actual_production = False
    live_costs: dict[Any, Decimal | None] = {}

    for plan in plans:
        recipes = getattr(plan.product, "active_recipe_cache", [])
        if plan.product_id not in live_costs:
            live_costs[plan.product_id] = current_recipe_unit_cost(recipes[0]) if recipes else None
        if plan.actual_quantity is not None:
            quantity = plan.actual_quantity
            unit_cost = plan.actual_unit_material_cost or live_costs[plan.product_id]
            used_actual_production = True
        else:
            quantity = plan.quantity
            unit_cost = live_costs[plan.product_id]
        if quantity <= 0:
            continue
        if unit_cost is None:
            missing_cost_count += 1
            continue
        material_cost += Decimal(quantity) * unit_cost

    labour_cost = Decimal("0")
    shifts = ScheduleEntry.objects.filter(
        work_date=target_date,
        employee__isnull=False,
    ).select_related("employee")
    for shift in shifts:
        labour_cost += shift_wage(shift)

    month_end = date(target_date.year, target_date.month, monthrange(target_date.year, target_date.month)[1])
    closed_days: set[date] = set()
    closures = BusinessClosure.objects.filter(start_date__lte=month_end, end_date__gte=month)
    for closure in closures:
        current = max(closure.start_date, month)
        end = min(closure.end_date, month_end)
        while current <= end:
            closed_days.add(current)
            current += timedelta(days=1)
    planned_business_days = max((month_end - month).days + 1 - len(closed_days), 1)
    monthly_operating_cost = sum(
        MonthlyCost.objects.filter(cost_month=month)
        .exclude(category=CostItem.Category.MATERIALS)
        .values_list("amount", flat=True),
        Decimal("0"),
    )
    allocated_operating_cost = (
        monthly_operating_cost / Decimal(planned_business_days)
        if target_date not in closed_days
        else Decimal("0")
    )

    direct_daily_cost = Decimal("0")
    direct_events = BusinessEvent.objects.filter(
        start_date__lte=target_date,
        end_date__gte=target_date,
        estimated_cost__isnull=False,
    )
    for event in direct_events:
        duration_days = (event.end_date - event.start_date).days + 1
        direct_daily_cost += event.estimated_cost / Decimal(duration_days)

    calculation_complete = missing_cost_count == 0
    total = material_cost + labour_cost + allocated_operating_cost + direct_daily_cost
    return {
        "total": f"{total.quantize(PENNY, rounding=ROUND_HALF_UP):.2f}" if calculation_complete else None,
        "material_cost": f"{material_cost.quantize(PENNY, rounding=ROUND_HALF_UP):.2f}",
        "labour_cost": f"{labour_cost.quantize(PENNY, rounding=ROUND_HALF_UP):.2f}",
        "allocated_operating_cost": f"{allocated_operating_cost.quantize(PENNY, rounding=ROUND_HALF_UP):.2f}",
        "direct_daily_cost": f"{direct_daily_cost.quantize(PENNY, rounding=ROUND_HALF_UP):.2f}",
        "planned_business_days": planned_business_days,
        "production_source": "ACTUAL" if used_actual_production else "PLAN",
        "labour_source": "ACTUAL" if target_date <= timezone.localdate() else "PLAN",
        "calculation_complete": calculation_complete,
        "missing_cost_count": missing_cost_count,
    }


def production_material_cost_details(
    month: date,
    today: date | None = None,
) -> dict[str, Any]:
    """Return the production records that make up a month's material cost."""
    boundary = today or timezone.localdate()
    rows: list[dict[str, Any]] = []
    total = Decimal("0")
    missing_cost_count = 0
    live_costs: dict[Any, Decimal | None] = {}

    def live_unit_cost(plan: ProductionPlan) -> Decimal | None:
        if plan.product_id in live_costs:
            return live_costs[plan.product_id]
        recipes = getattr(plan.product, "active_recipe_cache", [])
        cost = current_recipe_unit_cost(recipes[0]) if recipes else None
        live_costs[plan.product_id] = cost
        return cost

    for plan in _production_plans_for_month(month):
        actual_quantity = plan.actual_quantity or 0
        actual_cost: Decimal | None = None
        planned_quantity = 0
        planned_cost: Decimal | None = None

        if plan.planned_date < boundary:
            actual_cost = plan.actual_unit_material_cost
        elif plan.planned_date == boundary:
            actual_cost = plan.actual_unit_material_cost or live_unit_cost(plan)
            planned_quantity = max(plan.quantity - actual_quantity, 0)
            planned_cost = live_unit_cost(plan)
        else:
            planned_quantity = plan.quantity
            planned_cost = live_unit_cost(plan)

        actual_amount = Decimal(actual_quantity) * actual_cost if actual_cost is not None else None
        planned_amount = Decimal(planned_quantity) * planned_cost if planned_cost is not None else None
        row_complete = (actual_quantity == 0 or actual_amount is not None) and (
            planned_quantity == 0 or planned_amount is not None
        )
        if not row_complete and (actual_quantity or planned_quantity):
            missing_cost_count += int(
                (actual_quantity > 0 and actual_amount is None)
                or (planned_quantity > 0 and planned_amount is None)
            )
        row_total = (actual_amount or Decimal("0")) + (planned_amount or Decimal("0"))
        total += row_total
        rows.append(
            {
                "production_plan_id": str(plan.id),
                "production_date": plan.planned_date.isoformat(),
                "product_id": str(plan.product_id),
                "product_name_zh": plan.product.name_zh,
                "product_name_en": plan.product.name_en,
                "planned_quantity": plan.quantity,
                "actual_quantity": actual_quantity,
                "remaining_planned_quantity": planned_quantity,
                "actual_unit_cost": f"{actual_cost:.4f}" if actual_cost is not None else None,
                "planned_unit_cost": f"{planned_cost:.4f}" if planned_cost is not None else None,
                "actual_cost": f"{actual_amount:.2f}" if actual_amount is not None else None,
                "planned_cost": f"{planned_amount:.2f}" if planned_amount is not None else None,
                "total_cost": f"{row_total:.2f}",
                "source": "ACTUAL" if plan.planned_date <= boundary else "PLAN",
                "calculation_complete": row_complete,
            }
        )

    return {
        "month": month.strftime("%Y-%m"),
        "total": f"{total.quantize(PENNY, rounding=ROUND_HALF_UP):.2f}",
        "missing_cost_count": missing_cost_count,
        "items": rows,
    }


def monthly_costs_with_materials(month: date) -> tuple[list[Any], dict[str, Any]]:
    from bakeops.costs.models import CostItem, MonthlyCost

    ensure_cost_month(month)
    costs = list(MonthlyCost.objects.filter(cost_month=month).select_related("cost_item"))
    material_summary = production_material_cost_summary(month)
    material_rows = [cost for cost in costs if cost.category == CostItem.Category.MATERIALS]
    for index, cost in enumerate(material_rows):
        cost.amount = material_summary["total"] if index == 0 else Decimal("0.00")
        cost.calculation_complete = material_summary["is_complete"] if index == 0 else True
        cost.missing_cost_count = material_summary["missing_cost_count"] if index == 0 else 0
    return costs, material_summary
