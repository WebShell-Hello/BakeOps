from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from bakeops.sales.models import SalesDataRecord


def _apply_values(record: SalesDataRecord, values: dict[str, Any]) -> None:
    product = values["product"]
    record.sales_date = values["sales_date"]
    record.channel = values["channel"]
    record.product = product
    record.product_name_zh = product.name_zh
    record.product_name_en = product.name_en
    record.quantity = values["quantity"]
    record.received_amount = values["received_amount"]
    record.discount_amount = values["discount_amount"]
    record.refund_amount = values["refund_amount"]


def _validate_and_save(record: SalesDataRecord) -> SalesDataRecord:
    try:
        record.full_clean()
        record.save()
    except DjangoValidationError as error:
        raise ValidationError(error.message_dict) from error
    except IntegrityError as error:
        raise ValidationError(
            {"records": "A row already exists for this date, channel and product."}
        ) from error
    return record


@transaction.atomic
def update_sales_data(record: SalesDataRecord, values: dict[str, Any]) -> SalesDataRecord:
    locked = SalesDataRecord.objects.select_for_update().get(pk=record.pk)
    _apply_values(locked, values)
    return _validate_and_save(locked)


@transaction.atomic
def import_sales_data(rows: list[dict[str, Any]]) -> list[SalesDataRecord]:
    keys = [(row["sales_date"], row["channel"], row["product"].id) for row in rows]
    if len(keys) != len(set(keys)):
        raise ValidationError({"records": "The import contains duplicate date, channel and product rows."})

    existing_keys = set(
        SalesDataRecord.objects.filter(
            sales_date__in={key[0] for key in keys},
            channel__in={key[1] for key in keys},
            product_id__in={key[2] for key in keys},
        ).values_list("sales_date", "channel", "product_id")
    )
    duplicates = set(keys) & existing_keys
    if duplicates:
        raise ValidationError(
            {"records": "One or more date, channel and product rows already exist."}
        )

    created: list[SalesDataRecord] = []
    for row in rows:
        record = SalesDataRecord()
        _apply_values(record, row)
        created.append(_validate_and_save(record))
    return created


@transaction.atomic
def delete_sales_data(record_ids: list[Any]) -> int:
    unique_ids = list(dict.fromkeys(record_ids))
    records = list(SalesDataRecord.objects.select_for_update().filter(id__in=unique_ids))
    if len(records) != len(unique_ids):
        raise ValidationError({"record_ids": "One or more sales data rows no longer exist."})
    SalesDataRecord.objects.filter(id__in=unique_ids).delete()
    return len(records)
