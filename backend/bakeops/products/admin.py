from django.contrib import admin

from bakeops.products.models import Ingredient, Product, Recipe, RecipeIngredient, RecipeSection


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ("name", "base_unit", "is_active")
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name_zh", "name_en", "code", "sale_status", "updated_at")
    list_filter = ("sale_status",)
    search_fields = ("name_zh", "name_en", "code")


admin.site.register(Recipe)
admin.site.register(RecipeSection)
admin.site.register(RecipeIngredient)
