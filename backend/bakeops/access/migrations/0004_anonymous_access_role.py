from django.db import migrations, models


def ensure_anonymous_access_role(apps, schema_editor):  # type: ignore[no-untyped-def]
    Role = apps.get_model("access", "Role")
    role = Role.objects.filter(code="anonymous-user").first()
    if role is None:
        role = Role.objects.filter(name="未登录用户").first()
        if role is None:
            Role.objects.create(
                code="anonymous-user",
                name="未登录用户",
                description="Controls what visitors can see before signing in.",
                is_protected=True,
                is_assignable=False,
                anonymous_access_mode="LOGIN_PAGE",
            )
            return
        role.code = "anonymous-user"

    update_fields = []
    desired_values = {
        "is_protected": True,
        "is_assignable": False,
        "anonymous_access_mode": role.anonymous_access_mode or "LOGIN_PAGE",
    }
    if not role.name:
        desired_values["name"] = "未登录用户"
    if not role.description:
        desired_values["description"] = "Controls what visitors can see before signing in."
    if role.deleted_at is not None:
        desired_values["deleted_at"] = None

    for field, value in desired_values.items():
        if getattr(role, field) != value:
            setattr(role, field, value)
            update_fields.append(field)
    if update_fields:
        role.save(update_fields=update_fields)


class Migration(migrations.Migration):

    dependencies = [
        ("access", "0003_seed_store_guest"),
    ]

    operations = [
        migrations.AddField(
            model_name="role",
            name="anonymous_access_mode",
            field=models.CharField(
                choices=[
                    ("NONE", "None"),
                    ("LOGIN_PAGE", "Login page"),
                    ("SYSTEM_PAGE", "System page"),
                ],
                default="NONE",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="role",
            name="is_assignable",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(ensure_anonymous_access_role, migrations.RunPython.noop),
    ]
