from django.db import migrations


def rename_profitability_analysis(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(key="analytics.profitability").update(
        label_zh="盈利分析",
        label_en="Profitability Analysis",
    )


def restore_profitability_product_name(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(key="analytics.profitability").update(
        label_zh="盈利与产品表现",
        label_en="Profitability & Product Performance",
    )


class Migration(migrations.Migration):
    dependencies = [("navigation", "0009_merge_profitability_navigation")]

    operations = [migrations.RunPython(rename_profitability_analysis, restore_profitability_product_name)]
