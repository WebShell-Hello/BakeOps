import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def map_existing_owners(apps, schema_editor):
    ActivityPlan = apps.get_model("events", "ActivityPlan")
    Employee = apps.get_model("employees", "Employee")
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)

    employees_by_email = {
        employee.email.lower(): employee.id
        for employee in Employee.objects.exclude(email__isnull=True).exclude(email="")
    }
    users_by_id = {
        user.id: user.email.lower()
        for user in User.objects.exclude(email__isnull=True).exclude(email="")
    }
    for plan in ActivityPlan.objects.exclude(owner_id__isnull=True).iterator():
        employee_id = employees_by_email.get(users_by_id.get(plan.owner_id, ""))
        if employee_id:
            plan.responsible_employee_id = employee_id
            plan.save(update_fields=("responsible_employee",))


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0004_allow_optional_employee_dates_and_email"),
        ("events", "0003_seed_activity_planning_options"),
    ]

    operations = [
        migrations.AddField(
            model_name="activityplan",
            name="responsible_employee",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_activity_plans",
                to="employees.employee",
            ),
        ),
        migrations.RunPython(map_existing_owners, migrations.RunPython.noop),
    ]
