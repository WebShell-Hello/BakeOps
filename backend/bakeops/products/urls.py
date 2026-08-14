from django.urls import path

from bakeops.products.views import (
    ProductDetailApi,
    ProductIngredientCreateApi,
    ProductListCreateApi,
    RecipeIngredientDetailApi,
)

urlpatterns = [
    path("", ProductListCreateApi.as_view(), name="product-list"),
    path("<uuid:pk>/", ProductDetailApi.as_view(), name="product-detail"),
    path("<uuid:product_id>/ingredients/", ProductIngredientCreateApi.as_view(), name="product-ingredient-create"),
    path("ingredients/<uuid:pk>/", RecipeIngredientDetailApi.as_view(), name="product-ingredient-detail"),
]
