import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scheduling", "0003_link_existing_schedule_employees")]

    operations = [
        migrations.AddField(
            model_name="scheduleentry",
            name="break_minutes",
            field=models.PositiveSmallIntegerField(
                default=0,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
    ]
