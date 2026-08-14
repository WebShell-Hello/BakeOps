from django.db import migrations, models


def add_inventory_receipts(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    menu = NavigationMenu.objects.filter(code="main-sidebar").first()
    parent = NavigationItem.objects.filter(menu=menu, key="operations").first() if menu else None
    if menu is None or parent is None:
        return

    for child in NavigationItem.objects.filter(menu=menu, parent=parent, position__gte=3).order_by("-position"):
        child.position += 1
        child.save(update_fields=("position", "updated_at"))

    NavigationItem.objects.update_or_create(
        menu=menu,
        key="operations.inventory-receipts",
        defaults={
            "parent": parent,
            "item_type": "PAGE",
            "label_zh": "进货记录",
            "label_en": "Goods Receipts",
            "icon_key": "ClipboardList",
            "frontend_path": "/operations/inventory-receipts",
            "position": 3,
            "is_visible": True,
            "is_active": True,
        },
    )
    menu.revision = models.F("revision") + 1
    menu.save(update_fields=("revision", "updated_at"))


def remove_inventory_receipts(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    item = NavigationItem.objects.filter(key="operations.inventory-receipts").first()
    if item is None:
        return
    menu_id = item.menu_id
    parent_id = item.parent_id
    item.delete()
    for child in NavigationItem.objects.filter(
        menu_id=menu_id,
        parent_id=parent_id,
        position__gt=3,
    ).order_by("position"):
        child.position -= 1
        child.save(update_fields=("position", "updated_at"))
    NavigationMenu.objects.filter(id=menu_id).update(revision=models.F("revision") + 1)


class Migration(migrations.Migration):
    dependencies = [("navigation", "0007_add_cost_management")]
    operations = [migrations.RunPython(add_inventory_receipts, remove_inventory_receipts)]
