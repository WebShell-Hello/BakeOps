import datetime
from django.db import migrations, models


def populate_cost_month(apps, schema_editor):
    MonthlyCost = apps.get_model("costs", "MonthlyCost")
    for cost in MonthlyCost.objects.all().iterator():
        cost.cost_month = cost.incurred_date.replace(day=1)
        cost.save(update_fields=("cost_month",))


class Migration(migrations.Migration):
    dependencies = [("costs", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="monthlycost",
            name="cost_month",
            field=models.DateField(editable=False, null=True),
        ),
        migrations.RunPython(populate_cost_month, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="monthlycost",
            name="cost_month",
            field=models.DateField(editable=False),
        ),
        migrations.AddConstraint(
            model_name="monthlycost",
            constraint=models.UniqueConstraint(
                fields=("cost_item", "cost_month"),
                name="unique_cost_item_per_month",
            ),
        ),
    ]
