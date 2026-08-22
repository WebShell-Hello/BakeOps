from django.db import migrations


def add_audit_logs_page(apps, schema_editor):
    NavigationMenu = apps.get_model("navigation", "NavigationMenu")
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    menu = NavigationMenu.objects.get(code="main-sidebar")
    settings_item = NavigationItem.objects.get(menu=menu, key="settings")
    NavigationItem.objects.get_or_create(
        menu=menu,
        key="settings.audit-logs",
        defaults={
            "parent": settings_item,
            "item_type": "PAGE",
            "label_zh": "日志管理",
            "label_en": "Audit Logs",
            "icon_key": "ClipboardList",
            "frontend_path": "/settings/audit-logs",
            "position": 3,
        },
    )


def remove_audit_logs_page(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    NavigationItem.objects.filter(key="settings.audit-logs").delete()


class Migration(migrations.Migration):
    dependencies = [("navigation", "0010_rename_profitability_analysis")]

    operations = [migrations.RunPython(add_audit_logs_page, remove_audit_logs_page)]
