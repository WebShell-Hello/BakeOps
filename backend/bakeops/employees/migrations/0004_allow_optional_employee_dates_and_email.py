from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0003_employee_departure_date_employee_hire_date"),
    ]

    operations = [
        migrations.AlterField(
            model_name="employee",
            name="date_of_birth",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="employee",
            name="hire_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="employee",
            name="email",
            field=models.EmailField(blank=True, max_length=254, null=True, unique=True),
        ),
    ]
