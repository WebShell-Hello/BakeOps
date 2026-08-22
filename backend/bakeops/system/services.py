import base64
import json
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from tempfile import SpooledTemporaryFile
from typing import Any, BinaryIO
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

PRODUCTION_BACKUP_TABLES = (
    "access_role",
    "access_role_pages",
    "audit_access_log",
    "audit_audit_log",
    "auth_group",
    "auth_group_permissions",
    "auth_permission",
    "costs_costitem",
    "costs_costmonth",
    "costs_monthlycost",
    "django_admin_log",
    "django_content_type",
    "django_migrations",
    "django_session",
    "employees_employee",
    "events_activitycategory",
    "events_activityplatform",
    "events_activityplan",
    "events_activityplan_focus_products",
    "events_activityreminderrule",
    "events_activityreminderoccurrence",
    "events_businessclosure",
    "events_businessevent",
    "events_businessevent_focus_products",
    "events_eventchecklistitem",
    "events_holiday",
    "inventory_inventoryitem",
    "inventory_inventoryreceipt",
    "inventory_productionplan",
    "inventory_purchaserequest",
    "navigation_navigationitem",
    "navigation_navigationmenu",
    "products_ingredient",
    "products_product",
    "products_recipe",
    "products_recipeingredient",
    "products_recipesection",
    "sales_salesdatarecord",
    "sales_salesorder",
    "sales_salesorderline",
    "scheduling_scheduleentry",
    "suppliers_supplier",
    "suppliers_supplieringredient",
    "users_user",
    "users_user_groups",
    "users_user_roles",
    "users_user_user_permissions",
    "users_userpreference",
)


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (Decimal, UUID)):
        return str(value)
    if isinstance(value, bytes):
        return {"encoding": "base64", "value": base64.b64encode(value).decode("ascii")}
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _write_table(archive: ZipFile, table_name: str) -> int:
    quoted_table = connection.ops.quote_name(table_name)
    with connection.cursor() as cursor, archive.open(f"tables/{table_name}.json", "w") as target:
        cursor.execute(f"SELECT * FROM {quoted_table}")  # noqa: S608 - table names come from a fixed allowlist.
        columns = [column.name for column in cursor.description]
        target.write(
            json.dumps(
                {"table": table_name, "columns": columns},
                ensure_ascii=False,
                separators=(",", ":"),
            )[:-1].encode()
        )
        target.write(b',"rows":[')
        row_count = 0
        first_row = True
        while rows := cursor.fetchmany(1000):
            for row in rows:
                if not first_row:
                    target.write(b",")
                target.write(
                    json.dumps(
                        dict(zip(columns, row, strict=True)),
                        ensure_ascii=False,
                        separators=(",", ":"),
                        default=_json_default,
                    ).encode()
                )
                first_row = False
                row_count += 1
        target.write(b"]}")
    return row_count


def _write_media(archive: ZipFile) -> tuple[int, int]:
    media_root = Path(settings.MEDIA_ROOT)
    if not media_root.exists():
        return 0, 0
    file_count = 0
    total_bytes = 0
    for path in sorted(media_root.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        relative_path = path.relative_to(media_root)
        archive.write(path, f"media/{relative_path.as_posix()}")
        file_count += 1
        total_bytes += path.stat().st_size
    return file_count, total_bytes


def build_production_backup(include_media: bool) -> tuple[BinaryIO, str]:
    generated_at = timezone.now()
    filename = f"bakeops-production-backup-{generated_at.strftime('%Y%m%dT%H%M%SZ')}.zip"
    output = SpooledTemporaryFile(max_size=16 * 1024 * 1024, mode="w+b")
    table_counts: dict[str, int] = {}
    missing_tables: list[str] = []

    use_repeatable_read = connection.vendor == "postgresql" and not connection.in_atomic_block
    try:
        with transaction.atomic():
            if use_repeatable_read:
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            available_tables = set(connection.introspection.table_names())
            with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
                for table_name in PRODUCTION_BACKUP_TABLES:
                    if table_name not in available_tables:
                        missing_tables.append(table_name)
                        continue
                    table_counts[table_name] = _write_table(archive, table_name)

                media_file_count = 0
                media_total_bytes = 0
                if include_media:
                    media_file_count, media_total_bytes = _write_media(archive)

                manifest = {
                    "format": "bakeops-production-backup-v1",
                    "generated_at": generated_at.isoformat(),
                    "database_vendor": connection.vendor,
                    "include_media": include_media,
                    "tables": table_counts,
                    "missing_tables": missing_tables,
                    "media": {
                        "file_count": media_file_count,
                        "total_bytes": media_total_bytes,
                    },
                }
                archive.writestr(
                    "manifest.json",
                    json.dumps(manifest, ensure_ascii=False, indent=2, default=_json_default),
                )
        output.seek(0)
        return output, filename
    except Exception:
        output.close()
        raise
