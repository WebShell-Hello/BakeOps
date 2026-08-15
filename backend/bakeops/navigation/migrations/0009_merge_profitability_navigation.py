from django.db import migrations


def update_profitability_navigation(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(
        key__in=("analytics.product-performance", "analytics.labour")
    ).update(is_active=False, is_visible=False)
    NavigationItem.objects.filter(key="analytics.profitability").update(
        label_zh="盈利与产品表现",
        label_en="Profitability & Product Performance",
    )


def restore_profitability_navigation(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(
        key__in=("analytics.product-performance", "analytics.labour")
    ).update(is_active=True, is_visible=True)
    NavigationItem.objects.filter(key="analytics.profitability").update(
        label_zh="盈利分析",
        label_en="Profitability",
    )


class Migration(migrations.Migration):
    dependencies = [("navigation", "0008_add_inventory_receipts")]

    operations = [migrations.RunPython(update_profitability_navigation, restore_profitability_navigation)]
