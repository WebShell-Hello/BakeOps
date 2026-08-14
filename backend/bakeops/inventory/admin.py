from django.contrib import admin

from bakeops.inventory.models import InventoryItem, InventoryReceipt, ProductionPlan, PurchaseRequest


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("ingredient", "quantity", "inventory_value", "safety_buffer_days", "updated_at")
    search_fields = ("ingredient__name",)


@admin.register(ProductionPlan)
class ProductionPlanAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("reference", "product", "planned_date", "quantity", "actual_quantity", "status")
    list_filter = ("status", "planned_date")
    search_fields = ("reference", "product__name_zh", "product__name_en")


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("reference", "ingredient", "supplier", "quantity", "unit", "status", "created_at")
    list_filter = ("status", "currency")
    search_fields = ("reference", "ingredient__name", "supplier__name")


@admin.register(InventoryReceipt)
class InventoryReceiptAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("reference", "ingredient", "supplier", "quantity", "unit", "received_at")
    search_fields = ("reference", "ingredient__name", "supplier__name")
