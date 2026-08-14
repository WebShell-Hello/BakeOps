from datetime import date, timedelta
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from bakeops.events.models import BusinessClosure
from bakeops.inventory.models import ProductionPlan
from bakeops.products.models import Product

HISTORY_START = date(2025, 8, 15)
HISTORY_END = date(2026, 8, 14)
DISCONTINUED_AFTER = {
    "凉皮": date(2026, 3, 31),
    "胡辣汤": date(2026, 5, 31),
}
COMPLETION_RATES = (88, 92, 96, 99, 100, 103, 106)
BUSINESS_LEVELS = ((100, 160), (220, 280), (300, 400), (450, 500))


def closure_dates() -> set[date]:
    result: set[date] = set()
    for closure in BusinessClosure.objects.filter(
        start_date__lte=HISTORY_END,
        end_date__gte=HISTORY_START,
    ):
        current = max(closure.start_date, HISTORY_START)
        end = min(closure.end_date, HISTORY_END)
        while current <= end:
            result.add(current)
            current += timedelta(days=1)
    return result


def is_available(product: Product, production_date: date) -> bool:
    discontinued_after = DISCONTINUED_AFTER.get(product.name_zh)
    return discontinued_after is None or production_date <= discontinued_after


def planned_quantity(product: Product, product_index: int, day_index: int, production_date: date) -> int:
    level_index = (day_index // 28 + product_index * 3) % len(BUSINESS_LEVELS)
    low, high = BUSINESS_LEVELS[level_index]
    quantity = low + ((day_index * 17 + product_index * 29) % (high - low + 1))
    if production_date.weekday() in {4, 5, 6}:
        quantity = min(500, quantity + 20)
    if production_date.month == 12:
        quantity = min(500, quantity + 25)
    elif production_date.month == 1:
        quantity = max(100, quantity - 15)
    return quantity


class Command(BaseCommand):
    help = "Seed one year of historical production plans and actual production through 14 August 2026."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not Product.objects.filter(recipes__is_active=True).exists():
            call_command("seed_demo_products")
        call_command("seed_leadership_products")
        products = list(Product.objects.filter(recipes__is_active=True).prefetch_related("recipes").order_by("code"))
        for product in products:
            product.active_recipe_cache = [recipe for recipe in product.recipes.all() if recipe.is_active]

        closed_dates = closure_dates()
        for product_name, discontinued_after in DISCONTINUED_AFTER.items():
            ProductionPlan.objects.filter(
                reference__startswith="HIST-",
                product__name_zh=product_name,
                planned_date__gt=discontinued_after,
            ).delete()
        current = HISTORY_START
        day_index = 0
        created = 0
        updated = 0
        preserved = 0

        while current <= HISTORY_END:
            if current not in closed_dates:
                for product_index, product in enumerate(products):
                    if not is_available(product, current):
                        continue
                    if (day_index + product_index * 2) % 7 == 0:
                        continue

                    planned = planned_quantity(product, product_index, day_index, current)
                    completion_rate = COMPLETION_RATES[(day_index * 2 + product_index * 3) % len(COMPLETION_RATES)]
                    if current == HISTORY_END:
                        completion_rate = 68 + ((product_index * 5 + day_index) % 21)
                    actual = min(500, max(100, round(planned * completion_rate / 100)))
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
                            "status": ProductionPlan.Status.CONFIRMED,
                            "notes": "Historical demo production data · 100-500份经营区间模拟",
                        },
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1

            current += timedelta(days=1)
            day_index += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded production history for {HISTORY_START.isoformat()} to {HISTORY_END.isoformat()}: "
                f"{created} plans created, {updated} demo plans updated, {preserved} user plans preserved."
            )
        )
