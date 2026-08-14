from django.contrib import admin

from bakeops.suppliers.models import Supplier, SupplierIngredient


class SupplierIngredientInline(admin.TabularInline):  # type: ignore[type-arg]
    model = SupplierIngredient
    extra = 0


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name", "contact_name", "phone", "email", "updated_at")
    search_fields = ("name", "address", "contact_name", "phone", "email")
    inlines = (SupplierIngredientInline,)


@admin.register(SupplierIngredient)
class SupplierIngredientAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("supplier", "ingredient", "unit_price", "price_unit", "is_active", "is_preferred")
    list_filter = ("is_active", "is_preferred", "currency")
    search_fields = ("supplier__name", "ingredient__name")

