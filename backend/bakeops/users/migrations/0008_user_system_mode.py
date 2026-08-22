import json
from pathlib import Path

from django.conf import settings
from django.db import migrations, models


def migrate_global_mode_to_users(apps, schema_editor):
    environment = "TEST"
    config_path = getattr(settings, "DATA_SOURCE_CONFIG_FILE", "")
    if config_path:
        try:
            payload = json.loads(Path(config_path).read_text())
            if payload.get("environment") == "PRODUCTION":
                environment = "PRODUCTION"
        except (OSError, TypeError, ValueError):
            pass
    apps.get_model("users", "User").objects.update(system_mode=environment)


def reset_users_to_test(apps, schema_editor):
    apps.get_model("users", "User").objects.update(system_mode="TEST")


class Migration(migrations.Migration):
    dependencies = [("users", "0007_promote_global_superuser")]
    operations = [
        migrations.AddField(
            model_name="user",
            name="system_mode",
            field=models.CharField(
                choices=[("TEST", "Test"), ("PRODUCTION", "Production")],
                default="TEST",
                max_length=10,
            ),
        ),
        migrations.RunPython(migrate_global_mode_to_users, reset_users_to_test),
    ]
