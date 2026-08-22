import time
from datetime import timedelta

from django.conf import settings
from django.http import FileResponse
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.audit.middleware import build_log_data
from bakeops.audit.models import AuditLog
from bakeops.system.permissions import IsGlobalSuperuser
from bakeops.system.services import build_production_backup


class ProductionBackupApi(APIView):
    permission_classes = (IsGlobalSuperuser,)

    def get(self, request: Request) -> FileResponse:
        include_media = request.query_params.get("include_media", "false").lower() in {"1", "true", "yes"}
        audit_data = build_log_data(request, time.monotonic(), request.user)
        AuditLog.objects.create(
            action=AuditLog.Action.EXPORT,
            reason="Production backup export",
            resource_type="system.production-backup",
            system_mode=AuditLog.SystemMode.PRODUCTION,
            retention_expires_at=timezone.now() + timedelta(days=settings.AUDIT_EVENT_RETENTION_DAYS),
            metadata={"include_media": include_media},
            **{
                key: value
                for key, value in audit_data.items()
                if key not in {"system_mode", "retention_expires_at", "resource_type"}
            },
        )
        backup_file, filename = build_production_backup(include_media)
        response = FileResponse(
            backup_file,
            as_attachment=True,
            filename=filename,
            content_type="application/zip",
        )
        response["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response["Pragma"] = "no-cache"
        return response
