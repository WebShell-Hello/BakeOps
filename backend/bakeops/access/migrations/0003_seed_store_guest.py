from django.db import migrations


def ensure_store_guest_role(apps, schema_editor):  # type: ignore[no-untyped-def]
    Role = apps.get_model("access", "Role")
    role, created = Role.objects.get_or_create(
        code="store-guest",
        defaults={
            "name": "guest",
            "description": "Default role for self-registered store users",
            "is_protected": True,
        },
    )
    if created:
        return

    update_fields = []
    if not role.is_protected:
        role.is_protected = True
        update_fields.append("is_protected")
    if role.deleted_at is not None:
        role.deleted_at = None
        update_fields.append("deleted_at")
    if update_fields:
        role.save(update_fields=update_fields)


class Migration(migrations.Migration):

    dependencies = [
        ("access", "0002_role_deletion_state"),
    ]

    operations = [
        migrations.RunPython(ensure_store_guest_role, migrations.RunPython.noop),
    ]
