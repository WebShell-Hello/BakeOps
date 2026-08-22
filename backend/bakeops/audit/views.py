import time
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.audit.middleware import build_log_data
from bakeops.audit.models import AccessLog, AuditLog
from bakeops.audit.permissions import CanManageAuditLogs
from bakeops.audit.serializers import AccessLogSerializer, AuditLogSerializer
from bakeops.audit.services import should_record_access


def apply_filters(queryset: Any, request: Request) -> Any:
    params = request.query_params
    actor_type = params.get("actor_type")
    action = params.get("action")
    search = params.get("search", "").strip()
    if actor_type in {"USER", "GUEST", "SYSTEM"}:
        queryset = queryset.filter(actor_type=actor_type)
    if action:
        queryset = queryset.filter(action=action)
    if search:
        queryset = queryset.filter(
            Q(path__icontains=search)
            | Q(resource_type__icontains=search)
            | Q(resource_id__icontains=search)
            | Q(ip_hash__icontains=search)
            | Q(user__username__icontains=search)
        )
    return queryset


class AccessLogListApi(generics.ListAPIView[AccessLog]):
    permission_classes = (CanManageAuditLogs,)
    serializer_class = AccessLogSerializer

    def get_queryset(self) -> Any:
        return apply_filters(AccessLog.objects.select_related("user"), self.request)


class AuditLogListApi(generics.ListAPIView[AuditLog]):
    permission_classes = (CanManageAuditLogs,)
    serializer_class = AuditLogSerializer

    def get_queryset(self) -> Any:
        return apply_filters(AuditLog.objects.select_related("user"), self.request)


class PageViewLogApi(APIView):
    permission_classes = (AllowAny,)

    def post(self, request: Request) -> Response:
        path = str(request.data.get("path", ""))[:500]
        if not path.startswith("/"):
            return Response({"detail": "A valid page path is required."}, status=400)
        data = build_log_data(request, time.monotonic(), request.user if request.user.is_authenticated else None)
        data.update(
            {
                "method": "PAGE",
                "path": path,
                "page_key": str(request.data.get("page_key", ""))[:120],
                "status_code": 200,
                "success": True,
                "metadata": {"source": "frontend"},
            }
        )
        if should_record_access(AccessLog.Action.PAGE_VIEW, data):
            AccessLog.objects.create(action=AccessLog.Action.PAGE_VIEW, **data)
        return Response(status=204)


class ClientActionLogApi(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        method = str(request.data.get("method", "")).upper()
        path = str(request.data.get("path", ""))[:500]
        actions = {
            "POST": AuditLog.Action.CREATE,
            "PUT": AuditLog.Action.UPDATE,
            "PATCH": AuditLog.Action.UPDATE,
            "DELETE": AuditLog.Action.DELETE,
        }
        if method not in actions or not path.startswith("/"):
            return Response({"detail": "A valid mutation method and path are required."}, status=400)

        data = build_log_data(request, time.monotonic(), request.user)
        data.update(
            {
                "method": method,
                "path": path,
                "resource_type": str(request.data.get("resource_type", ""))[:120],
                "resource_id": str(request.data.get("resource_id", ""))[:120],
                "status_code": 200,
                "success": True,
                "metadata": {"source": "frontend_local_test"},
                "retention_expires_at": timezone.now()
                + timedelta(days=settings.AUDIT_EVENT_RETENTION_DAYS),
            }
        )
        AuditLog.objects.create(action=actions[method], reason="Local test data operation", **data)
        return Response(status=204)
