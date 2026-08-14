from django.contrib import admin

from bakeops.costs.models import CostItem, CostMonth, MonthlyCost


@admin.register(CostItem)
class CostItemAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_zh", "category", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("name_en", "name_zh", "notes")


@admin.register(MonthlyCost)
class MonthlyCostAdmin(admin.ModelAdmin):
    list_display = ("name_en", "amount", "incurred_date")
    list_filter = ("incurred_date", "category")
    search_fields = ("name_en", "name_zh", "notes")


@admin.register(CostMonth)
class CostMonthAdmin(admin.ModelAdmin):
    list_display = ("month", "created_at")
