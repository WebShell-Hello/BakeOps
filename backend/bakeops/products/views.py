from typing import Any

from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.products.models import Product, Recipe, RecipeIngredient, RecipeSection
from bakeops.products.permissions import CanManageProducts
from bakeops.products.serializers import ProductSerializer, RecipeIngredientSerializer, RecipeIngredientWriteSerializer


def product_queryset() -> Any:
    items = RecipeIngredient.objects.select_related(
        "ingredient",
        "ingredient__inventory_item",
        "section",
    ).order_by("position")
    sections = RecipeSection.objects.order_by("position").prefetch_related(Prefetch("items", queryset=items))
    recipes = Recipe.objects.order_by("-version").prefetch_related(Prefetch("sections", queryset=sections))
    return Product.objects.prefetch_related(Prefetch("recipes", queryset=recipes))


class ProductListCreateApi(generics.ListCreateAPIView[Product]):
    permission_classes = (CanManageProducts,)
    serializer_class = ProductSerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        return product_queryset()


class ProductDetailApi(generics.RetrieveUpdateDestroyAPIView[Product]):
    permission_classes = (CanManageProducts,)
    serializer_class = ProductSerializer

    def get_queryset(self) -> Any:
        return product_queryset()


class ProductIngredientCreateApi(APIView):
    permission_classes = (CanManageProducts,)

    def post(self, request: Request, product_id: Any) -> Response:
        product = get_object_or_404(Product, pk=product_id)
        recipe = get_object_or_404(Recipe, product=product, is_active=True)
        serializer = RecipeIngredientWriteSerializer(data=request.data, context={"recipe": recipe})
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(RecipeIngredientSerializer(item).data, status=status.HTTP_201_CREATED)


class RecipeIngredientDetailApi(APIView):
    permission_classes = (CanManageProducts,)

    def put(self, request: Request, pk: Any) -> Response:
        item = get_object_or_404(RecipeIngredient.objects.select_related("section__recipe", "ingredient"), pk=pk)
        serializer = RecipeIngredientWriteSerializer(item, data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(RecipeIngredientSerializer(serializer.save()).data)

    def delete(self, request: Request, pk: Any) -> Response:
        item = get_object_or_404(RecipeIngredient.objects.select_related("section"), pk=pk)
        section = item.section
        item.delete()
        if not section.items.exists():
            section.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
