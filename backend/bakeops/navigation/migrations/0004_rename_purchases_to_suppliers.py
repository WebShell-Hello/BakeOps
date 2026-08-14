from django.db import migrations, models


def rename_purchases_to_suppliers(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    updated = NavigationItem.objects.filter(key="operations.purchases").update(
        key="operations.suppliers",
        label_zh="供应商管理",
        label_en="Supplier Management",
        frontend_path="/operations/suppliers",
    )
    if updated:
        NavigationMenu.objects.filter(items__key="operations.suppliers").distinct().update(
            revision=models.F("revision") + 1
        )


def restore_purchases_and_suppliers(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(key="operations.suppliers").update(
        key="operations.purchases",
        label_zh="采购与供应商",
        label_en="Purchases & Suppliers",
        frontend_path="/operations/purchases-suppliers",
    )


class Migration(migrations.Migration):
    dependencies = [("navigation", "0003_rename_attendance_to_schedule")]

    operations = [migrations.RunPython(rename_purchases_to_suppliers, restore_purchases_and_suppliers)]

