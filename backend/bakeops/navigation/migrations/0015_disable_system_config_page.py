from django.db import migrations


def disable_page(apps, schema_editor):
    Item = apps.get_model("navigation", "NavigationItem")
    Role = apps.get_model("access", "Role")
    page = Item.objects.filter(key="settings.system-config").first()
    if page is None:
        return
    for role in Role.objects.filter(pages=page):
        role.pages.remove(page)
    page.is_active = False
    page.is_visible = False
    page.save(update_fields=("is_active", "is_visible", "updated_at"))


def enable_page(apps, schema_editor):
    Item = apps.get_model("navigation", "NavigationItem")
    Role = apps.get_model("access", "Role")
    page = Item.objects.filter(key="settings.system-config").first()
    if page is None:
        return
    page.is_active = True
    page.is_visible = True
    page.save(update_fields=("is_active", "is_visible", "updated_at"))
    admin_pages = Item.objects.filter(
        key__in=("settings.users", "settings.roles-permissions", "settings.menu-management")
    ).values_list("id", flat=True)
    for role in Role.objects.filter(pages__id__in=admin_pages).distinct():
        role.pages.add(page)


class Migration(migrations.Migration):
    dependencies = [
        ("navigation", "0014_grant_system_config_page"),
        ("access", "0004_anonymous_access_role"),
    ]
    operations = [migrations.RunPython(disable_page, enable_page)]
