from django.db import migrations


def link_existing_entries(apps, schema_editor):
    employee_model = apps.get_model("employees", "Employee")
    schedule_model = apps.get_model("scheduling", "ScheduleEntry")
    employee_by_name = {employee.name: employee for employee in employee_model.objects.all()}
    for entry in schedule_model.objects.filter(employee__isnull=True):
        employee = employee_by_name.get(entry.employee_name)
        if employee is not None:
            entry.employee = employee
            entry.save(update_fields=("employee",))


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0001_initial"),
        ("scheduling", "0002_scheduleentry_employee"),
    ]

    operations = [
        migrations.RunPython(link_existing_entries, migrations.RunPython.noop),
    ]
