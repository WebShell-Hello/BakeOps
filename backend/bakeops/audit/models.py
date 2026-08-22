from datetime import datetime

from django.conf import settings
from django.db import models

from bakeops.common.models import BaseModel


class LogBase(BaseModel):
    class ActorType(models.TextChoices):
        USER = "USER", "User"
        GUEST = "GUEST", "Guest"
        SYSTEM = "SYSTEM", "System"

    class SystemMode(models.TextChoices):
        TEST = "TEST", "Test"
        PRODUCTION = "PRODUCTION", "Production"
        UNKNOWN = "UNKNOWN", "Unknown"

    system_mode = models.CharField(
        max_length=12,
        choices=SystemMode.choices,
        default=SystemMode.UNKNOWN,
    )
    actor_type = models.CharField(max_length=10, choices=ActorType.choices, default=ActorType.GUEST)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="%(class)s_logs",
    )
    visitor_id = models.UUIDField(blank=True, null=True)
    session_key = models.CharField(max_length=80, blank=True)
    request_id = models.UUIDField(blank=True, null=True)
    method = models.CharField(max_length=10, blank=True)
    path = models.CharField(max_length=500)
    page_key = models.CharField(max_length=120, blank=True)
    resource_type = models.CharField(max_length=120, blank=True)
    resource_id = models.CharField(max_length=120, blank=True)
    status_code = models.PositiveSmallIntegerField(default=200)
    success = models.BooleanField(default=True)
    duration_ms = models.PositiveIntegerField(blank=True, null=True)
    ip_hash = models.CharField(max_length=64, blank=True)
    country_code = models.CharField(max_length=2, blank=True)
    region = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    device_type = models.CharField(max_length=20, blank=True)
    os_family = models.CharField(max_length=30, blank=True)
    os_version = models.CharField(max_length=30, blank=True)
    browser_family = models.CharField(max_length=40, blank=True)
    browser_version = models.CharField(max_length=30, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    retention_expires_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        abstract = True
        indexes = (
            models.Index(fields=("-created_at",), name="%(class)s_created_idx"),
            models.Index(fields=("user", "-created_at"), name="%(class)s_user_time_idx"),
            models.Index(fields=("actor_type", "-created_at"), name="%(class)s_actor_time_idx"),
            models.Index(fields=("path", "-created_at"), name="%(class)s_path_time_idx"),
        )

    @property
    def occurred_at(self) -> datetime:
        return self.created_at


class AccessLog(LogBase):
    class Action(models.TextChoices):
        PAGE_VIEW = "PAGE_VIEW", "Page view"
        API_READ = "API_READ", "API read"
        API_REQUEST = "API_REQUEST", "API request"

    action = models.CharField(max_length=30, choices=Action.choices, default=Action.API_REQUEST)

    class Meta(LogBase.Meta):
        db_table = "audit_access_log"
        ordering = ("-created_at",)


class AuditLog(LogBase):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"
        LOGIN_FAILED = "LOGIN_FAILED", "Login failed"
        PERMISSION_DENIED = "PERMISSION_DENIED", "Permission denied"
        EXPORT = "EXPORT", "Export"
        UPLOAD = "UPLOAD", "Upload"
        DOWNLOAD = "DOWNLOAD", "Download"
        OTHER = "OTHER", "Other"

    action = models.CharField(max_length=30, choices=Action.choices)
    reason = models.CharField(max_length=255, blank=True)
    changed_fields = models.JSONField(default=dict, blank=True)

    class Meta(LogBase.Meta):
        db_table = "audit_audit_log"
        permissions = (("manage_audit_logs", "Can view and manage audit logs"),)
        ordering = ("-created_at",)
