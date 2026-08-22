import django.core.validators
import django.db.models.deletion
import uuid
from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SalesDataRecord",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("sales_date", models.DateField(db_index=True)),
                (
                    "channel",
                    models.CharField(
                        choices=[
                            ("DIRECT", "On-site direct"),
                            ("CONSIGNMENT", "Consignment"),
                            ("DELIVERY", "Delivery platform"),
                        ],
                        max_length=20,
                    ),
                ),
                ("product_name_zh", models.CharField(max_length=120)),
                ("product_name_en", models.CharField(max_length=120)),
                ("quantity", models.PositiveIntegerField()),
                (
                    "received_amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
                    ),
                ),
                (
                    "discount_amount",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
                    ),
                ),
                (
                    "refund_amount",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("0.00"),
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="sales_data_records",
                        to="products.product",
                    ),
                ),
            ],
            options={
                "ordering": ("-sales_date", "channel", "product_name_en"),
                "indexes": [
                    models.Index(fields=["sales_date", "channel"], name="sales_data_date_channel_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("sales_date", "channel", "product"),
                        name="unique_sales_date_channel_product",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("refund_amount__lte", models.F("received_amount"))),
                        name="sales_data_refund_not_above_received",
                    ),
                ],
            },
        ),
    ]
