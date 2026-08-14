from django.db import migrations, models


def rename_inventory(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    updated = NavigationItem.objects.filter(key="operations.inventory").update(
        label_zh="库存管理",
        label_en="Inventory Management",
    )
    if updated:
        NavigationMenu.objects.filter(items__key="operations.inventory").distinct().update(
            revision=models.F("revision") + 1
        )


def restore_inventory(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(key="operations.inventory").update(label_zh="库存", label_en="Inventory")


class Migration(migrations.Migration):
    dependencies = [("navigation", "0004_rename_purchases_to_suppliers")]

    operations = [migrations.RunPython(rename_inventory, restore_inventory)]
