from decimal import Decimal

import django.core.validators
from django.db import migrations, models


def initialise_empty_inventory_values(apps, schema_editor):
    InventoryItem = apps.get_model("inventory", "InventoryItem")
    InventoryItem.objects.filter(quantity=0).update(inventory_value=Decimal("0"))


class Migration(migrations.Migration):
    dependencies = [("inventory", "0004_alter_productionplan_options_and_more")]

    operations = [
        migrations.AddField(
            model_name="inventoryitem",
            name="inventory_value",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text=("Current inventory book value in GBP. Null means the existing stock is not fully valued."),
                max_digits=16,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
            ),
        ),
        migrations.RunPython(initialise_empty_inventory_values, migrations.RunPython.noop),
    ]
