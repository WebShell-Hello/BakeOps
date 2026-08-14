import django.contrib.auth.validators
from django.db import migrations, models


def populate_usernames(apps, schema_editor):
    User = apps.get_model("users", "User")
    used: set[str] = set()
    for user in User.objects.order_by("created_at", "id"):
        base = user.email.split("@", maxsplit=1)[0].strip().lower() or "user"
        candidate = base
        suffix = 2
        while candidate in used or User.objects.filter(username=candidate).exclude(pk=user.pk).exists():
            candidate = f"{base}-{suffix}"
            suffix += 1
        user.username = candidate
        user.save(update_fields=("username",))
        used.add(candidate)


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0002_role_deletion_state"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="username",
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.RunPython(populate_usernames, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(
                max_length=150,
                unique=True,
                validators=(django.contrib.auth.validators.UnicodeUsernameValidator(),),
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="roles",
            field=models.ManyToManyField(blank=True, related_name="users", to="access.role"),
        ),
        migrations.AlterModelOptions(
            name="user",
            options={
                "ordering": ("username",),
                "permissions": (("manage_users", "Can manage system users"),),
            },
        ),
    ]
