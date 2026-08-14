from django.urls import path

from bakeops.suppliers.views import (
    IngredientOptionListApi,
    SupplierDetailApi,
    SupplierIngredientCreateApi,
    SupplierIngredientDetailApi,
    SupplierListCreateApi,
)

urlpatterns = [
    path("", SupplierListCreateApi.as_view(), name="supplier-list"),
    path("ingredient-options/", IngredientOptionListApi.as_view(), name="supplier-ingredient-options"),
    path("ingredients/<uuid:pk>/", SupplierIngredientDetailApi.as_view(), name="supplier-ingredient-detail"),
    path("<uuid:supplier_id>/ingredients/", SupplierIngredientCreateApi.as_view(), name="supplier-ingredient-create"),
    path("<uuid:pk>/", SupplierDetailApi.as_view(), name="supplier-detail"),
]

