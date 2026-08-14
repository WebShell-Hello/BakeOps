from django.db import migrations, models


def rename_attendance_to_schedule(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    updated = NavigationItem.objects.filter(key="people.attendance").update(
        label_zh="排班表",
        label_en="Schedule",
    )
    if updated:
        NavigationMenu.objects.filter(items__key="people.attendance").distinct().update(revision=models.F("revision") + 1)


def restore_attendance_name(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(key="people.attendance").update(label_zh="考勤", label_en="Attendance")


class Migration(migrations.Migration):
    dependencies = [("navigation", "0002_seed_main_sidebar")]

    operations = [migrations.RunPython(rename_attendance_to_schedule, restore_attendance_name)]
