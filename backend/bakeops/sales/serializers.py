from decimal import Decimal
from typing import Any

from rest_framework import serializers

from bakeops.products.models import Product
from bakeops.sales.models import SalesDataRecord, SalesOrderLine


class SalesRecordSerializer(serializers.ModelSerializer[SalesOrderLine]):
    order_id = serializers.UUIDField(read_only=True)
    reference = serializers.CharField(source="order.reference", read_only=True)
    sold_at = serializers.DateTimeField(source="order.sold_at", read_only=True)
    product_id = serializers.UUIDField(read_only=True)
    net_sales_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SalesOrderLine
        fields = (
            "id",
            "order_id",
            "reference",
            "sold_at",
            "product_id",
            "product_name_zh",
            "product_name_en",
            "quantity",
            "standard_unit_price",
            "standard_sales_amount",
            "discount_amount",
            "paid_amount",
            "refund_amount",
            "net_sales_amount",
            "created_at",
            "updated_at",
        )


class SalesRecordWriteSerializer(serializers.Serializer[dict[str, Any]]):
    reference = serializers.CharField(max_length=80)
    sold_at = serializers.DateTimeField()
    product_id = serializers.PrimaryKeyRelatedField(source="product", queryset=Product.objects.all())
    quantity = serializers.IntegerField(min_value=1)
    standard_unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    discount_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        default=Decimal("0"),
    )
    paid_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        required=False,
    )
    refund_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        default=Decimal("0"),
    )
    product_name_zh = serializers.CharField(required=False, allow_blank=True, write_only=True)
    product_name_en = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        standard_sales = Decimal(attrs["quantity"]) * attrs["standard_unit_price"]
        discount = attrs.get("discount_amount", Decimal("0"))
        if discount > standard_sales:
            raise serializers.ValidationError({"discount_amount": "Discount cannot exceed standard sales."})
        paid = attrs.get("paid_amount", standard_sales - discount)
        if attrs.get("refund_amount", Decimal("0")) > paid:
            raise serializers.ValidationError({"refund_amount": "Refund cannot exceed paid amount."})
        attrs["paid_amount"] = paid
        attrs.pop("product_name_zh", None)
        attrs.pop("product_name_en", None)
        return attrs


class SalesRecordImportSerializer(serializers.Serializer[dict[str, Any]]):
    records = SalesRecordWriteSerializer(many=True, allow_empty=False)


class SalesRecordBulkDeleteSerializer(serializers.Serializer[dict[str, Any]]):
    line_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)

    def validate_line_ids(self, value: list[Any]) -> list[Any]:
        return list(dict.fromkeys(value))


class SalesDataSerializer(serializers.ModelSerializer[SalesDataRecord]):
    product_id = serializers.UUIDField(read_only=True)
    standard_sales_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    net_sales_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SalesDataRecord
        fields = (
            "id",
            "sales_date",
            "channel",
            "product_id",
            "product_name_zh",
            "product_name_en",
            "quantity",
            "received_amount",
            "discount_amount",
            "refund_amount",
            "standard_sales_amount",
            "net_sales_amount",
            "created_at",
            "updated_at",
        )


class SalesDataWriteSerializer(serializers.Serializer[dict[str, Any]]):
    sales_date = serializers.DateField()
    channel = serializers.ChoiceField(choices=SalesDataRecord.Channel.choices)
    product_id = serializers.PrimaryKeyRelatedField(source="product", queryset=Product.objects.all())
    quantity = serializers.IntegerField(min_value=1)
    received_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    discount_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        default=Decimal("0"),
    )
    refund_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        default=Decimal("0"),
    )
    product_name_zh = serializers.CharField(required=False, allow_blank=True, write_only=True)
    product_name_en = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs.get("refund_amount", Decimal("0")) > attrs["received_amount"]:
            raise serializers.ValidationError({"refund_amount": "Refund cannot exceed received amount."})
        attrs.pop("product_name_zh", None)
        attrs.pop("product_name_en", None)
        return attrs


class SalesDataImportSerializer(serializers.Serializer[dict[str, Any]]):
    records = SalesDataWriteSerializer(many=True, allow_empty=False)


class SalesDataBulkDeleteSerializer(serializers.Serializer[dict[str, Any]]):
    record_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)

    def validate_record_ids(self, value: list[Any]) -> list[Any]:
        return list(dict.fromkeys(value))
