from django.db import migrations, models


def rename_calendar_events(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    updated = NavigationItem.objects.filter(key="planning.calendar-events").update(
        label_zh="活动管理",
        label_en="Event Management",
    )
    if updated:
        NavigationMenu.objects.filter(items__key="planning.calendar-events").distinct().update(
            revision=models.F("revision") + 1
        )


def restore_calendar_events(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(key="planning.calendar-events").update(
        label_zh="日历与活动",
        label_en="Calendar & Events",
    )


class Migration(migrations.Migration):
    dependencies = [("navigation", "0005_rename_inventory_to_inventory_management")]

    operations = [migrations.RunPython(rename_calendar_events, restore_calendar_events)]
