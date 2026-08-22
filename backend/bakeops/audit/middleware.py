import hashlib
import time
from collections.abc import Callable
from datetime import timedelta
from typing import Any
from uuid import UUID, uuid4

from django.conf import settings
from django.db import DatabaseError
from django.utils import timezone

from bakeops.audit.models import AccessLog, AuditLog, LogBase
from bakeops.audit.services import should_record_access, should_record_audit

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SELF_LOG_PATHS = {
    "/api/v1/audit/access/",
    "/api/v1/audit/audit/",
    "/api/v1/audit/client-actions/",
}


def client_metadata(request: Any) -> tuple[str, str, str, str]:
    user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]
    lower = user_agent.lower()
    if "ipad" in lower or "tablet" in lower:
        device = "TABLET"
    elif any(token in lower for token in ("mobile", "iphone", "android")):
        device = "MOBILE"
    elif "bot" in lower or "crawler" in lower:
        device = "BOT"
    else:
        device = "DESKTOP"

    if "iphone" in lower or "ipad" in lower:
        os_family = "iOS"
    elif "android" in lower:
        os_family = "Android"
    elif "windows" in lower:
        os_family = "Windows"
    elif "mac os" in lower or "macintosh" in lower:
        os_family = "macOS"
    elif "linux" in lower:
        os_family = "Linux"
    else:
        os_family = "Unknown"

    if "safari" in lower and "chrome" not in lower:
        browser = "Safari"
    elif "chrome" in lower:
        browser = "Chrome"
    elif "firefox" in lower:
        browser = "Firefox"
    else:
        browser = "Other"
    return device, os_family, browser, user_agent


def build_log_data(request: Any, started_at: float, user: Any = None) -> dict[str, Any]:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR", "")
    device, os_family, browser, user_agent = client_metadata(request)
    visitor = request.COOKIES.get("bo_visitor_id", "")
    try:
        visitor_id = UUID(visitor)
    except (ValueError, TypeError):
        visitor_id = None
    requested_mode = str(request.META.get("HTTP_X_BAKEOPS_SYSTEM_MODE", "")).upper()
    system_mode = (
        requested_mode
        if requested_mode in {LogBase.SystemMode.TEST, LogBase.SystemMode.PRODUCTION}
        else LogBase.SystemMode.UNKNOWN
    )
    return {
        "system_mode": system_mode,
        "actor_type": "USER" if user else "GUEST",
        "user": user,
        "visitor_id": visitor_id,
        "session_key": request.session.session_key or "",
        "request_id": uuid4(),
        "method": request.method,
        "path": request.path[:500],
        "ip_hash": hashlib.sha256(f"{ip}:{settings.SECRET_KEY}".encode()).hexdigest() if ip else "",
        "country_code": (request.META.get("HTTP_CF_IPCOUNTRY") or request.META.get("HTTP_X_VERCEL_IP_COUNTRY") or "")[
            :2
        ],
        "region": request.META.get("HTTP_X_VERCEL_IP_COUNTRY_REGION", "")[:100],
        "city": request.META.get("HTTP_X_VERCEL_IP_CITY", "")[:100],
        "device_type": device,
        "os_family": os_family,
        "browser_family": browser,
        "user_agent": user_agent,
        "duration_ms": max(0, int((time.monotonic() - started_at) * 1000)),
        "retention_expires_at": timezone.now() + timedelta(days=settings.AUDIT_ACCESS_RETENTION_DAYS),
    }


class AuditLoggingMiddleware:
    def __init__(self, get_response: Callable[[Any], Any]) -> None:
        self.get_response = get_response

    def __call__(self, request: Any) -> Any:
        visitor_id = request.COOKIES.get("bo_visitor_id") or str(uuid4())
        request.COOKIES["bo_visitor_id"] = visitor_id
        user_before_response = request.user if getattr(request.user, "is_authenticated", False) else None
        started_at = time.monotonic()
        response = self.get_response(request)
        response.set_cookie(
            "bo_visitor_id",
            visitor_id,
            max_age=60 * 60 * 24 * 365,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
        )
        if (
            not request.path.startswith("/api/v1/")
            or request.path.startswith("/api/v1/audit/page-views/")
            or request.path in SELF_LOG_PATHS
        ):
            return response

        user = user_before_response
        if request.path.endswith("/users/auth/login/") and response.status_code < 400:
            user = request.user if getattr(request.user, "is_authenticated", False) else None
        data = build_log_data(request, started_at, user)
        data.update({"status_code": response.status_code, "success": response.status_code < 400})
        try:
            access_action = (
                AccessLog.Action.API_READ if request.method in {"GET", "HEAD"} else AccessLog.Action.API_REQUEST
            )
            if should_record_access(access_action, data):
                AccessLog.objects.create(action=access_action, **data)
            self._write_audit_log(request, response.status_code, data)
        except DatabaseError:
            # Logging must never make an otherwise valid business request fail.
            pass
        return response

    @staticmethod
    def _write_audit_log(request: Any, status_code: int, data: dict[str, Any]) -> None:
        if request.path.endswith("/users/auth/login/"):
            action = AuditLog.Action.LOGIN if status_code < 400 else AuditLog.Action.LOGIN_FAILED
        elif request.path.endswith("/users/auth/logout/"):
            action = AuditLog.Action.LOGOUT
        elif request.method in MUTATING_METHODS:
            action = {
                "POST": AuditLog.Action.CREATE,
                "PUT": AuditLog.Action.UPDATE,
                "PATCH": AuditLog.Action.UPDATE,
                "DELETE": AuditLog.Action.DELETE,
            }[request.method]
            if status_code in {401, 403}:
                action = AuditLog.Action.PERMISSION_DENIED
        else:
            return
        if not should_record_audit(action, data):
            return
        audit_data = {
            **data,
            "retention_expires_at": timezone.now() + timedelta(days=settings.AUDIT_EVENT_RETENTION_DAYS),
        }
        AuditLog.objects.create(action=action, reason="HTTP request", **audit_data)
