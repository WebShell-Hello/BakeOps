from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0005_inventoryitem_inventory_value"),
    ]

    operations = [
        migrations.AddField(
            model_name="productionplan",
            name="actual_cost_captured_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="productionplan",
            name="actual_unit_material_cost",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="Estimated material cost per finished product captured when actual production is recorded.",
                max_digits=12,
                null=True,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
    ]
