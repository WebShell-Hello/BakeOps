import io
import json
from zipfile import ZipFile

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from bakeops.audit.models import AuditLog
from bakeops.users.constants import GLOBAL_SUPERUSER_EMAIL
from bakeops.users.models import User


def authenticated_client(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def response_bytes(response) -> bytes:
    return b"".join(response.streaming_content)


@pytest.mark.django_db
def test_only_global_superuser_can_download_production_backup() -> None:
    ordinary_superuser = User.objects.create_superuser(
        username="other-admin",
        email="other-admin@example.com",
        password="password123",
    )

    client = authenticated_client(ordinary_superuser)
    response = client.get(reverse("system-production-backup"))

    assert response.status_code == 403
    assert client.get(reverse("auth-me")).data["can_export_production_backup"] is False


@pytest.mark.django_db
def test_production_backup_exports_tables_without_media_by_default() -> None:
    global_superuser = User.objects.create_superuser(
        username="global-admin",
        email=GLOBAL_SUPERUSER_EMAIL,
        password="password123",
    )

    client = authenticated_client(global_superuser)
    response = client.get(reverse("system-production-backup"))

    assert response.status_code == 200
    assert client.get(reverse("auth-me")).data["can_export_production_backup"] is True
    assert response["Content-Type"] == "application/zip"
    assert response["Cache-Control"] == "no-store, no-cache, must-revalidate, private"
    with ZipFile(io.BytesIO(response_bytes(response))) as archive:
        names = set(archive.namelist())
        manifest = json.loads(archive.read("manifest.json"))
        users = json.loads(archive.read("tables/users_user.json"))

    assert manifest["format"] == "bakeops-production-backup-v1"
    assert manifest["include_media"] is False
    assert manifest["tables"]["users_user"] >= 1
    assert not any(name.startswith("media/") for name in names)
    assert any(row["email"] == GLOBAL_SUPERUSER_EMAIL for row in users["rows"])
    assert AuditLog.objects.filter(action=AuditLog.Action.EXPORT, system_mode="PRODUCTION").exists()
    response.close()


@pytest.mark.django_db
def test_production_backup_can_include_media(tmp_path) -> None:
    global_superuser = User.objects.create_superuser(
        username="global-admin-media",
        email=GLOBAL_SUPERUSER_EMAIL,
        password="password123",
    )
    invoice = tmp_path / "receipt-invoices" / "2026" / "08" / "invoice.pdf"
    invoice.parent.mkdir(parents=True)
    invoice.write_bytes(b"%PDF-1.4 backup-test")

    with override_settings(MEDIA_ROOT=tmp_path):
        response = authenticated_client(global_superuser).get(
            reverse("system-production-backup"),
            {"include_media": "true"},
        )

    assert response.status_code == 200
    with ZipFile(io.BytesIO(response_bytes(response))) as archive:
        names = set(archive.namelist())
        manifest = json.loads(archive.read("manifest.json"))
        media_contents = archive.read("media/receipt-invoices/2026/08/invoice.pdf")

    assert manifest["include_media"] is True
    assert manifest["media"] == {"file_count": 1, "total_bytes": len(media_contents)}
    assert "media/receipt-invoices/2026/08/invoice.pdf" in names
    assert media_contents == b"%PDF-1.4 backup-test"
    response.close()
