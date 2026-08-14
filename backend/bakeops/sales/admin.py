from django.contrib import admin

from bakeops.sales.models import SalesOrder, SalesOrderLine


class SalesOrderLineInline(admin.TabularInline):
    model = SalesOrderLine
    extra = 0


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ("reference", "sold_at", "created_at")
    search_fields = ("reference", "lines__product_name_zh", "lines__product_name_en")
    list_filter = ("sold_at",)
    inlines = (SalesOrderLineInline,)


@admin.register(SalesOrderLine)
class SalesOrderLineAdmin(admin.ModelAdmin):
    list_display = ("order", "product_name_en", "quantity", "paid_amount", "refund_amount")
    search_fields = ("order__reference", "product_name_zh", "product_name_en")
