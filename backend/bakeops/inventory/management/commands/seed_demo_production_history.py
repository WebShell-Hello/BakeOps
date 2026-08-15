from datetime import date, timedelta
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from bakeops.events.models import BusinessClosure, BusinessEvent
from bakeops.inventory.models import ProductionPlan
from bakeops.products.models import Product

HISTORY_START = date(2025, 8, 15)
HISTORY_END = date(2026, 8, 14)
PLAN_END = date(2026, 12, 31)
STABLE_TRADING_START = date(2026, 7, 17)
COMPLETION_RATES = (88, 92, 96, 99, 100, 103, 106)
BUSINESS_LEVELS = ((100, 160), (220, 280), (300, 400), (450, 500))
DAILY_PRODUCT_CODES = (
    "PLAIN-TOAST",
    "WHOLEWHEAT-TOAST",
    "MILK-TOAST",
    "RED-BEAN-TOAST",
    "PLAIN-CROISSANT",
    "CHOCOLATE-CROISSANT",
    "ALMOND-CROISSANT",
    "CINNAMON-ROLL",
    "BAGUETTE",
    "SOURDOUGH",
    "WALNUT-CRANBERRY-BREAD",
    "PINEAPPLE-BUN",
    "PORK-FLOSS-BUN",
    "RED-BEAN-BUN",
    "EGG-TART",
    "SAQIMA",
    "ROSE-PASTRY",
    "HAM-CHEESE-SANDWICH",
    "CHICKEN-SALAD-SANDWICH",
    "CROISSANT-HAM-CHEESE-SANDWICH",
)
LIMITED_PRODUCT_CODES = (
    "STRAWBERRY-DANISH",
    "BLUEBERRY-CHEESE-DANISH",
    "APPLE-CINNAMON-DANISH",
    "PUMPKIN-SPICE-BREAD",
    "CHESTNUT-CROISSANT",
    "PISTACHIO-CROISSANT",
    "EGG-YOLK-PASTRY",
    "CUSTARD-MOONCAKE",
    "CHRISTMAS-FRUIT-BREAD",
    "CHOCOLATE-STRAWBERRY-CROISSANT",
)


def closure_dates() -> set[date]:
    result: set[date] = set()
    for closure in BusinessClosure.objects.filter(
        start_date__lte=PLAN_END,
        end_date__gte=HISTORY_START,
    ):
        current = max(closure.start_date, HISTORY_START)
        end = min(closure.end_date, PLAN_END)
        while current <= end:
            result.add(current)
            current += timedelta(days=1)
    return result


def event_dates() -> dict[date, str]:
    result: dict[date, str] = {}
    events = BusinessEvent.objects.filter(start_date__lte=PLAN_END, end_date__gte=HISTORY_START)
    for event in events:
        current = max(event.start_date, HISTORY_START)
        end = min(event.end_date, PLAN_END)
        while current <= end:
            result[current] = event.expected_impact
            current += timedelta(days=1)
    return result


def activity_impact(production_date: date, explicit_events: dict[date, str]) -> str | None:
    explicit_impact = explicit_events.get(production_date)
    if explicit_impact:
        return explicit_impact
    if production_date.day <= 7 and production_date.weekday() in {5, 6}:
        return "MEDIUM"
    return None


def daily_planned_quantity(day_index: int, production_date: date, impact: str | None) -> int:
    if production_date >= STABLE_TRADING_START:
        low, high = 300, 500
    else:
        level_index = (day_index // 28) % len(BUSINESS_LEVELS)
        low, high = BUSINESS_LEVELS[level_index]
    quantity = low + ((day_index * 17) % (high - low + 1))
    if production_date.weekday() in {4, 5, 6}:
        quantity = min(500, quantity + 20)
    if production_date.month == 12:
        quantity = min(500, quantity + 25)
    elif production_date.month == 1:
        quantity = max(100, quantity - 15)
    impact_multiplier = {
        "LOW": 108,
        "MEDIUM": 115,
        "HIGH": 125,
    }.get(impact or "", 100)
    quantity = min(500, round(quantity * impact_multiplier / 100))
    return quantity


def allocate_quantity(total: int, item_count: int, seed: int) -> list[int]:
    if item_count <= 0:
        return []
    weights = [8 + ((seed + index * 5) % 9) for index in range(item_count)]
    distributable = max(total - item_count, 0)
    weight_total = sum(weights)
    quantities = [1 + distributable * weight // weight_total for weight in weights]
    remainder = total - sum(quantities)
    for offset in range(remainder):
        quantities[(seed + offset * 7) % item_count] += 1
    return quantities


class Command(BaseCommand):
    help = "Seed one year of production history plus current and future production plans."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not Product.objects.filter(recipes__is_active=True).exists():
            call_command("seed_demo_products")
        call_command("seed_leadership_products")
        products = list(Product.objects.filter(recipes__is_active=True).prefetch_related("recipes").order_by("code"))
        for product in products:
            product.active_recipe_cache = [recipe for recipe in product.recipes.all() if recipe.is_active]

        products_by_code = {product.code: product for product in products}
        daily_products = [products_by_code[code] for code in DAILY_PRODUCT_CODES if code in products_by_code]
        limited_products = [products_by_code[code] for code in LIMITED_PRODUCT_CODES if code in products_by_code]
        if not daily_products:
            self.stdout.write(self.style.WARNING("No leadership daily products were available."))
            return

        closed_dates = closure_dates()
        activities = event_dates()
        current = HISTORY_START
        day_index = 0
        created = 0
        updated = 0
        preserved = 0

        while current <= PLAN_END:
            if current not in closed_dates:
                normal_count = 15 + ((day_index + current.weekday()) % 6)
                impact = activity_impact(current, activities)
                limited_count = {"HIGH": 8, "MEDIUM": 6, "LOW": 5}.get(impact or "", 0)
                daily_count = normal_count - (3 if limited_count else 0)
                daily_count = min(daily_count, len(daily_products))
                limited_count = min(limited_count, len(limited_products), 25 - daily_count)

                selected_daily = [
                    daily_products[(day_index + offset) % len(daily_products)]
                    for offset in range(daily_count)
                ]
                selected_limited = [
                    limited_products[(day_index + offset * 3) % len(limited_products)]
                    for offset in range(limited_count)
                ]
                selected_products = selected_daily + selected_limited
                desired_product_ids = {product.id for product in selected_products}
                ProductionPlan.objects.filter(
                    reference__startswith="HIST-",
                    planned_date=current,
                ).exclude(product_id__in=desired_product_ids).delete()

                planned_total = daily_planned_quantity(day_index, current, impact)
                planned_quantities = allocate_quantity(planned_total, len(selected_products), day_index)
                actual_quantities: list[int | None] = [None] * len(selected_products)
                status = ProductionPlan.Status.PLANNED
                if current <= HISTORY_END:
                    completion_rate = COMPLETION_RATES[day_index % len(COMPLETION_RATES)]
                    if current == HISTORY_END:
                        completion_rate = 68 + (day_index % 21)
                    actual_total = min(500, max(1, round(planned_total * completion_rate / 100)))
                    if current >= STABLE_TRADING_START:
                        actual_total = max(220, actual_total)
                    actual_quantities = allocate_quantity(actual_total, len(selected_products), day_index + 11)
                    status = ProductionPlan.Status.CONFIRMED

                for product_index, product in enumerate(selected_products):
                    planned = planned_quantities[product_index]
                    actual = actual_quantities[product_index]
                    existing = ProductionPlan.objects.filter(planned_date=current, product=product).first()
                    if existing is not None and not existing.reference.startswith("HIST-"):
                        preserved += 1
                        continue
                    _, was_created = ProductionPlan.objects.update_or_create(
                        planned_date=current,
                        product=product,
                        defaults={
                            "reference": f"HIST-{product.code}-{current:%Y%m%d}",
                            "quantity": planned,
                            "actual_quantity": actual,
                            "status": status,
                            "notes": (
                                "活动日：限定产品替换部分日常产品 · " if limited_count else ""
                            ) + f"模拟生产数据 · 当日{len(selected_products)}种产品",
                        },
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1

            else:
                ProductionPlan.objects.filter(
                    reference__startswith="HIST-",
                    planned_date=current,
                ).delete()

            current += timedelta(days=1)
            day_index += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded production plans for {HISTORY_START.isoformat()} to {PLAN_END.isoformat()}: "
                f"{created} plans created, {updated} demo plans updated, {preserved} user plans preserved."
            )
        )
