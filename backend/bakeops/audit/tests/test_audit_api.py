from datetime import timedelta

import pytest
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from bakeops.audit.models import AccessLog, AuditLog
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    user = User.objects.create_superuser(email="audit-admin@example.com", password="test-password")
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_guest_page_view_is_logged_with_visitor_cookie() -> None:
    client = APIClient()
    response = client.post(
        reverse("audit-page-view"),
        {"path": "/", "page_key": "dashboard"},
        format="json",
        HTTP_X_BAKEOPS_SYSTEM_MODE="PRODUCTION",
    )

    assert response.status_code == 204
    entry = AccessLog.objects.get(action=AccessLog.Action.PAGE_VIEW)
    assert entry.actor_type == AccessLog.ActorType.GUEST
    assert entry.path == "/"
    assert entry.page_key == "dashboard"
    assert entry.system_mode == AccessLog.SystemMode.PRODUCTION
    assert entry.visitor_id is not None
    assert client.cookies.get("bo_visitor_id") is not None

    repeated_response = client.post(
        reverse("audit-page-view"),
        {"path": "/", "page_key": "dashboard"},
        format="json",
        HTTP_X_BAKEOPS_SYSTEM_MODE="PRODUCTION",
    )

    assert repeated_response.status_code == 204
    assert AccessLog.objects.filter(action=AccessLog.Action.PAGE_VIEW).count() == 1

    other_mode_response = client.post(
        reverse("audit-page-view"),
        {"path": "/", "page_key": "dashboard"},
        format="json",
        HTTP_X_BAKEOPS_SYSTEM_MODE="TEST",
    )

    assert other_mode_response.status_code == 204
    assert AccessLog.objects.filter(action=AccessLog.Action.PAGE_VIEW).count() == 2


@pytest.mark.django_db
def test_local_test_mutation_is_logged_with_test_mode(admin_client: APIClient) -> None:
    response = admin_client.post(
        reverse("audit-client-action"),
        {
            "method": "PATCH",
            "path": "/employees/employee-id/",
            "resource_type": "employees",
            "resource_id": "employee-id",
        },
        format="json",
        HTTP_X_BAKEOPS_SYSTEM_MODE="TEST",
    )

    assert response.status_code == 204
    entry = AuditLog.objects.get(reason="Local test data operation")
    assert entry.action == AuditLog.Action.UPDATE
    assert entry.path == "/employees/employee-id/"
    assert entry.system_mode == AuditLog.SystemMode.TEST
    assert entry.metadata == {"source": "frontend_local_test"}


@pytest.mark.django_db
def test_guest_cannot_read_audit_logs() -> None:
    response = APIClient().get(reverse("audit-access-list"))

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_can_read_audit_logs(admin_client: APIClient) -> None:
    AuditLog.objects.create(
        actor_type=AuditLog.ActorType.GUEST,
        path="/api/v1/inventory/overview/",
        action=AuditLog.Action.PERMISSION_DENIED,
        status_code=403,
        success=False,
    )

    response = admin_client.get(reverse("audit-audit-list"), {"action": "PERMISSION_DENIED"})

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["actor_type"] == "GUEST"


@pytest.mark.django_db
def test_reading_log_lists_does_not_create_more_logs(admin_client: APIClient) -> None:
    AccessLog.objects.create(actor_type=AccessLog.ActorType.GUEST, path="/", action=AccessLog.Action.PAGE_VIEW)

    assert admin_client.get(reverse("audit-access-list")).status_code == 200
    assert admin_client.get(reverse("audit-audit-list")).status_code == 200
    assert AccessLog.objects.count() == 1
    assert AuditLog.objects.count() == 0


@pytest.mark.django_db
def test_purge_expired_audit_logs_keeps_unexpired_records() -> None:
    expired = timezone.now() - timedelta(seconds=1)
    future = timezone.now() + timedelta(days=1)
    AccessLog.objects.create(path="/expired", action=AccessLog.Action.PAGE_VIEW, retention_expires_at=expired)
    AccessLog.objects.create(path="/active", action=AccessLog.Action.PAGE_VIEW, retention_expires_at=future)
    AuditLog.objects.create(path="/expired", action=AuditLog.Action.UPDATE, retention_expires_at=expired)

    call_command("purge_expired_audit_logs", batch_size=1)

    assert list(AccessLog.objects.values_list("path", flat=True)) == ["/active"]
    assert AuditLog.objects.count() == 0
