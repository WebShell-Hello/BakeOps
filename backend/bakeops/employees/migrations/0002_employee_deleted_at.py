from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="employee",
            index=models.Index(
                fields=["deleted_at", "employee_number"],
                name="employee_deleted_number_idx",
            ),
        ),
    ]
