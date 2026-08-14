from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from bakeops.inventory.models import InventoryItem, ProductionPlan
from bakeops.inventory.services import calculate_forecast_demand
from bakeops.products.models import Ingredient, Product


class Command(BaseCommand):
    help = "Create or refresh demo production plans and ingredient inventory."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not Product.objects.filter(recipes__is_active=True).exists():
            call_command("seed_demo_products")
        products = list(
            Product.objects.filter(recipes__is_active=True)
            .prefetch_related("recipes")
            .order_by("code")[:5]
        )
        today = timezone.localdate()

        plan_dates = (-3, -2, -1, 0, 1, 2, 3, 6, 7, 10, 13)
        for product_index, product in enumerate(products):
            recipe = next(recipe for recipe in product.recipes.all() if recipe.is_active)
            for plan_index, day_offset in enumerate(plan_dates):
                if (plan_index + product_index) % 3 == 2:
                    continue
                planned_quantity = recipe.yield_quantity * (2 + ((plan_index + product_index) % 4))
                actual_quantity = None
                if day_offset < 0:
                    completion_percent = (94, 100, 105)[(plan_index + product_index) % 3]
                    actual_quantity = round(planned_quantity * completion_percent / 100)
                elif day_offset == 0:
                    actual_quantity = round(planned_quantity * (65 + product_index * 4) / 100)
                reference = f"DEMO-{product.code}-{today + timedelta(days=day_offset):%Y%m%d}"
                ProductionPlan.objects.update_or_create(
                    planned_date=today + timedelta(days=day_offset),
                    product=product,
                    defaults={
                        "reference": reference,
                        "quantity": planned_quantity,
                        "actual_quantity": actual_quantity,
                        "status": ProductionPlan.Status.CONFIRMED,
                        "notes": "BakeOps production planning demo",
                    },
                )

        demand_by_ingredient, _ = calculate_forecast_demand(today)
        coverage_ratios = (
            Decimal("0.20"),
            Decimal("0.45"),
            Decimal("0.75"),
            Decimal("1.00"),
            Decimal("1.30"),
        )
        ingredients = Ingredient.objects.filter(is_active=True, recipe_items__isnull=False).distinct().order_by("name")
        for index, ingredient in enumerate(ingredients):
            demand = demand_by_ingredient.get(ingredient.id, Decimal("0"))
            quantity = demand * coverage_ratios[index % len(coverage_ratios)] if demand else Decimal("5000")
            InventoryItem.objects.update_or_create(
                ingredient=ingredient,
                defaults={
                    "quantity": quantity.quantize(Decimal("0.001")),
                    "safety_buffer_days": 2,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {ProductionPlan.objects.filter(reference__startswith='DEMO-').count()} plans and "
                f"{InventoryItem.objects.count()} inventory items."
            )
        )
