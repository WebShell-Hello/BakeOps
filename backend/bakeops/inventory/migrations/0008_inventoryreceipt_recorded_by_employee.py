import django.db.models.deletion
from django.db import migrations, models


def copy_matching_recorders(apps, schema_editor):
    InventoryReceipt = apps.get_model("inventory", "InventoryReceipt")
    Employee = apps.get_model("employees", "Employee")
    employees_by_email = {
        email.lower(): employee_id
        for employee_id, email in Employee.objects.exclude(email__isnull=True)
        .exclude(email="")
        .values_list("id", "email")
    }
    for receipt in InventoryReceipt.objects.select_related("created_by").iterator():
        email = (getattr(receipt.created_by, "email", "") or "").lower()
        employee_id = employees_by_email.get(email)
        if employee_id:
            receipt.recorded_by_employee_id = employee_id
            receipt.save(update_fields=("recorded_by_employee",))


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0004_allow_optional_employee_dates_and_email"),
        ("inventory", "0007_inventoryreceipt_invoice_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventoryreceipt",
            name="recorded_by_employee",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="inventory_receipts_recorded",
                to="employees.employee",
            ),
        ),
        migrations.RunPython(copy_matching_recorders, migrations.RunPython.noop),
    ]
