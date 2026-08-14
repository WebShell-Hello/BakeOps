import django.contrib.auth.validators
from django.db import migrations, models
from django.db.models.functions import Lower


def normalize_emails(apps, schema_editor):
    User = apps.get_model("users", "User")
    users = list(User.objects.order_by("created_at", "id"))
    normalized_emails = [user.email.strip().lower() for user in users]

    if len(normalized_emails) != len(set(normalized_emails)):
        raise ValueError("Email addresses must be unique regardless of letter case before this migration can run.")

    for user, normalized_email in zip(users, normalized_emails, strict=True):
        if user.email == normalized_email:
            continue
        user.email = normalized_email
        user.save(update_fields=("email",))


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0004_userpreference"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(
                max_length=150,
                validators=(django.contrib.auth.validators.UnicodeUsernameValidator(),),
            ),
        ),
        migrations.RunPython(normalize_emails, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(Lower("email"), name="users_user_email_ci_unique"),
        ),
    ]
