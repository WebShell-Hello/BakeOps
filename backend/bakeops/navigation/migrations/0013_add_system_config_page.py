from django.db import migrations


def add_page(apps, schema_editor):
    Menu = apps.get_model("navigation", "NavigationMenu")
    Item = apps.get_model("navigation", "NavigationItem")
    menu = Menu.objects.get(code="main-sidebar")
    parent = Item.objects.get(menu=menu, key="settings")
    Item.objects.get_or_create(
        menu=menu,
        key="settings.system-config",
        defaults={
            "parent": parent,
            "item_type": "PAGE",
            "label_zh": "系统配置",
            "label_en": "System Configuration",
            "icon_key": "Settings2",
            "frontend_path": "/settings/system-config",
            "position": 4,
        },
    )


def remove_page(apps, schema_editor):
    apps.get_model("navigation", "NavigationItem").objects.filter(key="settings.system-config").delete()


class Migration(migrations.Migration):
    dependencies = [("navigation", "0012_grant_audit_logs_page")]
    operations = [migrations.RunPython(add_page, remove_page)]
