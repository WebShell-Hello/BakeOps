from django.db import migrations


def grant_audit_logs_page(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    Role = apps.get_model("access", "Role")
    audit_page = NavigationItem.objects.get(key="settings.audit-logs")
    admin_page_ids = NavigationItem.objects.filter(
        key__in=("settings.users", "settings.roles-permissions", "settings.menu-management")
    ).values_list("id", flat=True)
    for role in Role.objects.filter(pages__id__in=admin_page_ids).distinct():
        role.pages.add(audit_page)


def revoke_audit_logs_page(apps, schema_editor):
    NavigationItem = apps.get_model("navigation", "NavigationItem")
    Role = apps.get_model("access", "Role")
    audit_page = NavigationItem.objects.filter(key="settings.audit-logs").first()
    if audit_page is not None:
        for role in Role.objects.filter(pages=audit_page):
            role.pages.remove(audit_page)


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0004_anonymous_access_role"),
        ("navigation", "0011_add_audit_logs_page"),
    ]

    operations = [migrations.RunPython(grant_audit_logs_page, revoke_audit_logs_page)]
