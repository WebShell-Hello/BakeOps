from django.db import migrations, models


def rename_sales_page(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    updated = NavigationItem.objects.filter(key="operations.sales").update(
        label_zh="销售明细",
        label_en="Sales Details",
        frontend_path="/operations/sales",
    )
    if updated:
        NavigationMenu.objects.filter(items__key="operations.sales").distinct().update(
            revision=models.F("revision") + 1
        )


def restore_sales_page_name(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(key="operations.sales").update(
        label_zh="销售",
        label_en="Sales",
        frontend_path="/operations/sales",
    )


class Migration(migrations.Migration):
    dependencies = [("navigation", "0016_restore_blank_system_config_page")]

    operations = [migrations.RunPython(rename_sales_page, restore_sales_page_name)]
