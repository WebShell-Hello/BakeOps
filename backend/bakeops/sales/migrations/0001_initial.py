import django.core.validators
import django.db.models.deletion
import uuid
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [("products", "0004_normalize_generated_english_names")]

    operations = [
        migrations.CreateModel(
            name="SalesOrder",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reference", models.CharField(max_length=80, unique=True)),
                ("sold_at", models.DateTimeField(db_index=True)),
            ],
            options={
                "ordering": ("-sold_at", "reference"),
                "permissions": (("manage_sales", "Can manage sales records and analytics"),),
            },
        ),
        migrations.CreateModel(
            name="SalesOrderLine",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("product_name_zh", models.CharField(max_length=120)),
                ("product_name_en", models.CharField(max_length=120)),
                ("quantity", models.PositiveIntegerField()),
                ("standard_unit_price", models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal("0.00"))])),
                ("standard_sales_amount", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0.00"))])),
                ("discount_amount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0.00"))])),
                ("paid_amount", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0.00"))])),
                ("refund_amount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0.00"))])),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="sales.salesorder")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="sales_order_lines", to="products.product")),
            ],
            options={
                "ordering": ("order__sold_at", "product_name_en"),
                "indexes": [models.Index(fields=["product", "order"], name="sales_line_product_order_idx")],
                "constraints": [
                    models.UniqueConstraint(fields=("order", "product"), name="unique_sales_order_product"),
                    models.CheckConstraint(condition=models.Q(("discount_amount__lte", models.F("standard_sales_amount"))), name="sales_discount_not_above_standard"),
                    models.CheckConstraint(condition=models.Q(("refund_amount__lte", models.F("paid_amount"))), name="sales_refund_not_above_paid"),
                ],
            },
        ),
    ]
