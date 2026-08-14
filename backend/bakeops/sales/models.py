from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q

from bakeops.common.models import BaseModel


class SalesOrder(BaseModel):
    reference = models.CharField(max_length=80, unique=True)
    sold_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ("-sold_at", "reference")
        permissions = (("manage_sales", "Can manage sales records and analytics"),)

    def __str__(self) -> str:
        return self.reference


class SalesOrderLine(BaseModel):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="sales_order_lines",
    )
    product_name_zh = models.CharField(max_length=120)
    product_name_en = models.CharField(max_length=120)
    quantity = models.PositiveIntegerField()
    standard_unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.00")),),
    )
    standard_sales_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.00")),),
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=(MinValueValidator(Decimal("0.00")),),
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.00")),),
    )
    refund_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=(MinValueValidator(Decimal("0.00")),),
    )

    class Meta:
        ordering = ("order__sold_at", "product_name_en")
        constraints = (
            models.UniqueConstraint(fields=("order", "product"), name="unique_sales_order_product"),
            models.CheckConstraint(
                condition=Q(discount_amount__lte=F("standard_sales_amount")),
                name="sales_discount_not_above_standard",
            ),
            models.CheckConstraint(
                condition=Q(refund_amount__lte=F("paid_amount")),
                name="sales_refund_not_above_paid",
            ),
        )
        indexes = (models.Index(fields=("product", "order"), name="sales_line_product_order_idx"),)

    @property
    def net_sales_amount(self) -> Decimal:
        return Decimal(str(self.paid_amount)) - Decimal(str(self.refund_amount))

    def __str__(self) -> str:
        return f"{self.order.reference} · {self.product_name_en} × {self.quantity}"
