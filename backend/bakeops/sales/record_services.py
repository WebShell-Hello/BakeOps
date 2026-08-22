from collections import defaultdict
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from bakeops.sales.models import SalesOrder, SalesOrderLine


def _standard_sales(quantity: int, unit_price: Decimal) -> Decimal:
    return (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))


@transaction.atomic
def update_sales_record(line: SalesOrderLine, values: dict[str, Any]) -> SalesOrderLine:
    order = SalesOrder.objects.select_for_update().get(pk=line.order_id)
    reference = values["reference"]
    if SalesOrder.objects.exclude(pk=order.pk).filter(reference=reference).exists():
        raise ValidationError({"reference": "A sales order with this reference already exists."})

    order.reference = reference
    order.sold_at = values["sold_at"]
    order.full_clean()
    order.save(update_fields=("reference", "sold_at", "updated_at"))

    product = values["product"]
    line.product = product
    line.product_name_zh = product.name_zh
    line.product_name_en = product.name_en
    line.quantity = values["quantity"]
    line.standard_unit_price = values["standard_unit_price"]
    line.standard_sales_amount = _standard_sales(line.quantity, line.standard_unit_price)
    line.discount_amount = values["discount_amount"]
    line.paid_amount = values["paid_amount"]
    line.refund_amount = values["refund_amount"]
    try:
        line.full_clean()
    except DjangoValidationError as error:
        raise ValidationError(error.message_dict) from error
    line.save()
    return line


@transaction.atomic
def import_sales_records(rows: list[dict[str, Any]]) -> list[SalesOrderLine]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["reference"]].append(row)
    existing = set(SalesOrder.objects.filter(reference__in=grouped).values_list("reference", flat=True))
    if existing:
        raise ValidationError({"records": f"Sales order references already exist: {', '.join(sorted(existing))}."})

    created: list[SalesOrderLine] = []
    for reference, order_rows in grouped.items():
        sold_at = order_rows[0]["sold_at"]
        if any(row["sold_at"] != sold_at for row in order_rows):
            raise ValidationError({"records": f"All rows for {reference} must use the same sold_at value."})
        product_ids = [row["product"].id for row in order_rows]
        if len(product_ids) != len(set(product_ids)):
            raise ValidationError({"records": f"Order {reference} contains the same product more than once."})

        order = SalesOrder.objects.create(reference=reference, sold_at=sold_at)
        for row in order_rows:
            product = row["product"]
            line = SalesOrderLine(
                order=order,
                product=product,
                product_name_zh=product.name_zh,
                product_name_en=product.name_en,
                quantity=row["quantity"],
                standard_unit_price=row["standard_unit_price"],
                standard_sales_amount=_standard_sales(row["quantity"], row["standard_unit_price"]),
                discount_amount=row["discount_amount"],
                paid_amount=row["paid_amount"],
                refund_amount=row["refund_amount"],
            )
            try:
                line.full_clean()
            except DjangoValidationError as error:
                raise ValidationError(error.message_dict) from error
            line.save()
            created.append(line)
    return created


@transaction.atomic
def delete_sales_records(line_ids: list[Any]) -> int:
    unique_ids = list(dict.fromkeys(line_ids))
    lines = list(SalesOrderLine.objects.select_for_update().filter(id__in=unique_ids))
    if len(lines) != len(unique_ids):
        raise ValidationError({"line_ids": "One or more sales records no longer exist."})
    order_ids = {line.order_id for line in lines}
    SalesOrderLine.objects.filter(id__in=unique_ids).delete()
    SalesOrder.objects.filter(id__in=order_ids, lines__isnull=True).delete()
    return len(lines)
