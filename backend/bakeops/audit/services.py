import hashlib
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from bakeops.audit.models import AccessLog, AuditLog


def _identity_filter(data: dict[str, Any]) -> Q:
    user = data.get("user")
    if user is not None:
        return Q(user=user)
    ip_hash = data.get("ip_hash", "")
    if ip_hash:
        return Q(ip_hash=ip_hash)
    return Q(visitor_id=data.get("visitor_id"))


def _dedupe_key(prefix: str, action: str, data: dict[str, Any]) -> str:
    user = data.get("user")
    identity = f"user:{user.pk}" if user is not None else f"guest:{data.get('ip_hash') or data.get('visitor_id')}"
    raw = ":".join(
        (
            prefix,
            identity,
            action,
            str(data.get("method", "")),
            str(data.get("path", "")),
            str(data.get("status_code", "")),
            str(data.get("system_mode", "")),
        )
    )
    return f"audit-dedupe:{hashlib.sha256(raw.encode()).hexdigest()}"


def should_record_access(action: str, data: dict[str, Any]) -> bool:
    window = (
        settings.AUDIT_BOT_DEDUP_SECONDS if data.get("device_type") == "BOT" else settings.AUDIT_ACCESS_DEDUP_SECONDS
    )
    if not cache.add(_dedupe_key("access", action, data), True, timeout=window):
        return False
    cutoff = timezone.now() - timedelta(seconds=window)
    return not AccessLog.objects.filter(
        _identity_filter(data),
        action=action,
        method=data.get("method", ""),
        path=data.get("path", ""),
        status_code=data.get("status_code", 200),
        system_mode=data.get("system_mode", AccessLog.SystemMode.UNKNOWN),
        created_at__gte=cutoff,
    ).exists()


def should_record_audit(action: str, data: dict[str, Any]) -> bool:
    if action not in {AuditLog.Action.LOGIN_FAILED, AuditLog.Action.PERMISSION_DENIED}:
        return True
    window = (
        settings.AUDIT_BOT_DEDUP_SECONDS if data.get("device_type") == "BOT" else settings.AUDIT_SECURITY_DEDUP_SECONDS
    )
    if not cache.add(_dedupe_key("audit", action, data), True, timeout=window):
        return False
    cutoff = timezone.now() - timedelta(seconds=window)
    return not AuditLog.objects.filter(
        _identity_filter(data),
        action=action,
        method=data.get("method", ""),
        path=data.get("path", ""),
        status_code=data.get("status_code", 200),
        system_mode=data.get("system_mode", AuditLog.SystemMode.UNKNOWN),
        created_at__gte=cutoff,
    ).exists()
