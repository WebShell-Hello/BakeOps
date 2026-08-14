import decimal
import django.core.validators
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


DEFAULT_ITEMS = (
    ("店铺房租", "Shop Rent", "RENT", ""),
    ("电费", "Electricity", "UTILITIES", ""),
    ("水费", "Water", "UTILITIES", ""),
    ("燃气费", "Gas", "UTILITIES", ""),
    ("保险", "Insurance", "INSURANCE", ""),
    ("软件订阅", "Software Subscriptions", "SOFTWARE", "POS / Accounting"),
    ("设备维修", "Equipment Maintenance", "MAINTENANCE", ""),
    ("清洁费用", "Cleaning", "CLEANING", ""),
    ("会计费用", "Accounting", "ACCOUNTING", ""),
    ("设备租赁", "Equipment Rental", "EQUIPMENT_RENTAL", ""),
    ("垃圾处理", "Waste Disposal", "WASTE", ""),
    ("其他经营成本", "Other Operating Costs", "OTHER", ""),
)


def seed_cost_items(apps, schema_editor):
    CostItem = apps.get_model("costs", "CostItem")
    for name_zh, name_en, category, notes in DEFAULT_ITEMS:
        CostItem.objects.update_or_create(
            name_en=name_en,
            defaults={
                "name_zh": name_zh,
                "category": category,
                "is_active": True,
                "notes": notes,
            },
        )


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="CostItem",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name_zh", models.CharField(max_length=120, unique=True)),
                ("name_en", models.CharField(max_length=120, unique=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("RENT", "Rent"),
                            ("UTILITIES", "Utilities"),
                            ("INSURANCE", "Insurance"),
                            ("SOFTWARE", "Software"),
                            ("MAINTENANCE", "Maintenance"),
                            ("CLEANING", "Cleaning"),
                            ("ACCOUNTING", "Accounting"),
                            ("EQUIPMENT_RENTAL", "Equipment rental"),
                            ("WASTE", "Waste disposal"),
                            ("OTHER", "Other"),
                        ],
                        max_length=24,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("notes", models.CharField(blank=True, max_length=500)),
            ],
            options={
                "ordering": ("category", "name_en"),
                "permissions": (("manage_costs", "Can manage operating costs"),),
            },
        ),
        migrations.CreateModel(
            name="MonthlyCost",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(decimal.Decimal("0.01"))],
                    ),
                ),
                ("incurred_date", models.DateField()),
                ("notes", models.CharField(blank=True, max_length=500)),
                (
                    "cost_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="monthly_costs",
                        to="costs.costitem",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="monthly_costs_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="monthly_costs_updated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ("incurred_date", "cost_item__name_en")},
        ),
        migrations.AddIndex(
            model_name="monthlycost",
            index=models.Index(fields=["incurred_date"], name="cost_incurred_date_idx"),
        ),
        migrations.RunPython(seed_cost_items, migrations.RunPython.noop),
    ]

