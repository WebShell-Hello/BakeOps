from django.db import migrations


def grant_page(apps, schema_editor):
    Item = apps.get_model("navigation", "NavigationItem")
    Role = apps.get_model("access", "Role")
    page = Item.objects.get(key="settings.system-config")
    admin_pages = Item.objects.filter(
        key__in=("settings.users", "settings.roles-permissions", "settings.menu-management")
    ).values_list("id", flat=True)
    for role in Role.objects.filter(pages__id__in=admin_pages).distinct():
        role.pages.add(page)


def revoke_page(apps, schema_editor):
    Item = apps.get_model("navigation", "NavigationItem")
    Role = apps.get_model("access", "Role")
    page = Item.objects.filter(key="settings.system-config").first()
    if page:
        for role in Role.objects.filter(pages=page):
            role.pages.remove(page)


class Migration(migrations.Migration):
    dependencies = [("navigation", "0013_add_system_config_page"), ("access", "0004_anonymous_access_role")]
    operations = [migrations.RunPython(grant_page, revoke_page)]
