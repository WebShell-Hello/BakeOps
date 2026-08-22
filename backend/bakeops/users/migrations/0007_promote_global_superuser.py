from django.db import migrations

GLOBAL_SUPERUSER_EMAIL = "joe.jiaqiao.wan@gmail.com"


def promote_global_superuser(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(email__iexact=GLOBAL_SUPERUSER_EMAIL).update(
        is_superuser=True,
        is_staff=True,
        is_active=True,
        is_protected=True,
    )


class Migration(migrations.Migration):
    dependencies = [("users", "0006_userpreference_sidebar_pinned")]
    operations = [migrations.RunPython(promote_global_superuser, migrations.RunPython.noop)]
