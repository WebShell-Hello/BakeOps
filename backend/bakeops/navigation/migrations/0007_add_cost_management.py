from django.db import migrations, models


def add_cost_management(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    menu = NavigationMenu.objects.filter(code="main-sidebar").first()
    parent = NavigationItem.objects.filter(menu=menu, key="analytics").first() if menu else None
    if menu is None or parent is None:
        return

    children = list(
        NavigationItem.objects.filter(menu=menu, parent=parent, position__gte=2).order_by("-position")
    )
    for child in children:
        child.position += 1
        child.save(update_fields=("position", "updated_at"))

    NavigationItem.objects.update_or_create(
        menu=menu,
        key="analytics.costs",
        defaults={
            "parent": parent,
            "item_type": "PAGE",
            "label_zh": "成本管理",
            "label_en": "Cost Management",
            "icon_key": "WalletCards",
            "frontend_path": "/analytics/costs",
            "position": 2,
            "is_visible": True,
            "is_active": True,
        },
    )
    menu.revision = models.F("revision") + 1
    menu.save(update_fields=("revision", "updated_at"))


def remove_cost_management(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    item = NavigationItem.objects.filter(key="analytics.costs").first()
    if item is None:
        return
    menu_id = item.menu_id
    parent_id = item.parent_id
    item.delete()
    for child in NavigationItem.objects.filter(
        menu_id=menu_id,
        parent_id=parent_id,
        position__gt=2,
    ).order_by("position"):
        child.position -= 1
        child.save(update_fields=("position", "updated_at"))
    NavigationMenu.objects.filter(id=menu_id).update(revision=models.F("revision") + 1)


class Migration(migrations.Migration):
    dependencies = [("navigation", "0006_rename_calendar_events_to_event_management")]
    operations = [migrations.RunPython(add_cost_management, remove_cost_management)]

