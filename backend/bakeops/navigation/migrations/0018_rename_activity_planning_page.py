from django.db import migrations, models


def rename_page(apps, schema_editor):
    Item = apps.get_model("navigation", "NavigationItem")
    Menu = apps.get_model("navigation", "NavigationMenu")
    if Item.objects.filter(key="planning.marketing").update(
        label_zh="活动策划",
        label_en="Activity Planning",
        frontend_path="/planning/marketing",
        is_active=True,
        is_visible=True,
    ):
        Menu.objects.filter(items__key="planning.marketing").distinct().update(
            revision=models.F("revision") + 1
        )


def restore_page(apps, schema_editor):
    Item = apps.get_model("navigation", "NavigationItem")
    Item.objects.filter(key="planning.marketing").update(
        label_zh="市场营销",
        label_en="Marketing",
    )


class Migration(migrations.Migration):
    dependencies = [("navigation", "0017_rename_operations_sales_details")]
    operations = [migrations.RunPython(rename_page, restore_page)]
