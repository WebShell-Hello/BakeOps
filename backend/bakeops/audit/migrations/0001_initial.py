import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [("users", "0006_userpreference_sidebar_pinned")]

    operations = [
        migrations.CreateModel(
            name="AccessLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("actor_type", models.CharField(choices=[("USER", "User"), ("GUEST", "Guest"), ("SYSTEM", "System")], default="GUEST", max_length=10)),
                ("visitor_id", models.UUIDField(blank=True, null=True)),
                ("session_key", models.CharField(blank=True, max_length=80)),
                ("request_id", models.UUIDField(blank=True, null=True)),
                ("method", models.CharField(blank=True, max_length=10)),
                ("path", models.CharField(max_length=500)),
                ("page_key", models.CharField(blank=True, max_length=120)),
                ("resource_type", models.CharField(blank=True, max_length=120)),
                ("resource_id", models.CharField(blank=True, max_length=120)),
                ("status_code", models.PositiveSmallIntegerField(default=200)),
                ("success", models.BooleanField(default=True)),
                ("duration_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("ip_hash", models.CharField(blank=True, max_length=64)),
                ("country_code", models.CharField(blank=True, max_length=2)),
                ("region", models.CharField(blank=True, max_length=100)),
                ("city", models.CharField(blank=True, max_length=100)),
                ("device_type", models.CharField(blank=True, max_length=20)),
                ("os_family", models.CharField(blank=True, max_length=30)),
                ("os_version", models.CharField(blank=True, max_length=30)),
                ("browser_family", models.CharField(blank=True, max_length=40)),
                ("browser_version", models.CharField(blank=True, max_length=30)),
                ("user_agent", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("retention_expires_at", models.DateTimeField(blank=True, null=True)),
                ("action", models.CharField(choices=[("PAGE_VIEW", "Page view"), ("API_READ", "API read"), ("API_REQUEST", "API request")], default="API_REQUEST", max_length=30)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="accesslog_logs", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "audit_access_log",
                "ordering": ("-created_at",),
                "indexes": [
                    models.Index(fields=["-created_at"], name="accesslog_created_idx"),
                    models.Index(fields=["user", "-created_at"], name="accesslog_user_time_idx"),
                    models.Index(fields=["actor_type", "-created_at"], name="accesslog_actor_time_idx"),
                    models.Index(fields=["path", "-created_at"], name="accesslog_path_time_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("actor_type", models.CharField(choices=[("USER", "User"), ("GUEST", "Guest"), ("SYSTEM", "System")], default="GUEST", max_length=10)),
                ("visitor_id", models.UUIDField(blank=True, null=True)),
                ("session_key", models.CharField(blank=True, max_length=80)),
                ("request_id", models.UUIDField(blank=True, null=True)),
                ("method", models.CharField(blank=True, max_length=10)),
                ("path", models.CharField(max_length=500)),
                ("page_key", models.CharField(blank=True, max_length=120)),
                ("resource_type", models.CharField(blank=True, max_length=120)),
                ("resource_id", models.CharField(blank=True, max_length=120)),
                ("status_code", models.PositiveSmallIntegerField(default=200)),
                ("success", models.BooleanField(default=True)),
                ("duration_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("ip_hash", models.CharField(blank=True, max_length=64)),
                ("country_code", models.CharField(blank=True, max_length=2)),
                ("region", models.CharField(blank=True, max_length=100)),
                ("city", models.CharField(blank=True, max_length=100)),
                ("device_type", models.CharField(blank=True, max_length=20)),
                ("os_family", models.CharField(blank=True, max_length=30)),
                ("os_version", models.CharField(blank=True, max_length=30)),
                ("browser_family", models.CharField(blank=True, max_length=40)),
                ("browser_version", models.CharField(blank=True, max_length=30)),
                ("user_agent", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("retention_expires_at", models.DateTimeField(blank=True, null=True)),
                ("action", models.CharField(choices=[("CREATE", "Create"), ("UPDATE", "Update"), ("DELETE", "Delete"), ("LOGIN", "Login"), ("LOGOUT", "Logout"), ("LOGIN_FAILED", "Login failed"), ("PERMISSION_DENIED", "Permission denied"), ("EXPORT", "Export"), ("UPLOAD", "Upload"), ("DOWNLOAD", "Download"), ("OTHER", "Other")], max_length=30)),
                ("reason", models.CharField(blank=True, max_length=255)),
                ("changed_fields", models.JSONField(blank=True, default=dict)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="auditlog_logs", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "audit_audit_log",
                "ordering": ("-created_at",),
                "indexes": [
                    models.Index(fields=["-created_at"], name="auditlog_created_idx"),
                    models.Index(fields=["user", "-created_at"], name="auditlog_user_time_idx"),
                    models.Index(fields=["actor_type", "-created_at"], name="auditlog_actor_time_idx"),
                    models.Index(fields=["path", "-created_at"], name="auditlog_path_time_idx"),
                ],
            },
        ),
    ]
