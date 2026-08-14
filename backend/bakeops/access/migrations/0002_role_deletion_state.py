from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("access", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="role",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="role",
            name="is_protected",
            field=models.BooleanField(default=False),
        ),
        migrations.AddIndex(
            model_name="role",
            index=models.Index(fields=["deleted_at", "is_protected"], name="role_deletion_state_idx"),
        ),
    ]
