from typing import Any

from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.products.models import Ingredient
from bakeops.suppliers.models import Supplier, SupplierIngredient
from bakeops.suppliers.permissions import CanManageSuppliers
from bakeops.suppliers.serializers import (
    IngredientOptionSerializer,
    SupplierIngredientSerializer,
    SupplierSerializer,
)


def supplier_queryset() -> Any:
    terms = SupplierIngredient.objects.select_related("ingredient").order_by(
        "-is_active",
        "ingredient__name",
    )
    return Supplier.objects.prefetch_related(Prefetch("supplied_ingredients", queryset=terms))


class SupplierListCreateApi(generics.ListCreateAPIView[Supplier]):
    permission_classes = (CanManageSuppliers,)
    serializer_class = SupplierSerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        queryset = supplier_queryset()
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(address__icontains=search)
                | Q(contact_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(email__icontains=search)
                | Q(notes__icontains=search)
            )
        return queryset


class SupplierDetailApi(generics.RetrieveUpdateAPIView[Supplier]):
    permission_classes = (CanManageSuppliers,)
    serializer_class = SupplierSerializer

    def get_queryset(self) -> Any:
        return supplier_queryset()


class IngredientOptionListApi(generics.ListAPIView[Ingredient]):
    permission_classes = (CanManageSuppliers,)
    serializer_class = IngredientOptionSerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        return Ingredient.objects.filter(is_active=True).order_by("name")


class SupplierIngredientCreateApi(APIView):
    permission_classes = (CanManageSuppliers,)

    def post(self, request: Request, supplier_id: Any) -> Response:
        supplier = get_object_or_404(Supplier, pk=supplier_id)
        serializer = SupplierIngredientSerializer(data=request.data, context={"supplier": supplier})
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(SupplierIngredientSerializer(item).data, status=status.HTTP_201_CREATED)


class SupplierIngredientDetailApi(generics.RetrieveUpdateAPIView[SupplierIngredient]):
    permission_classes = (CanManageSuppliers,)
    serializer_class = SupplierIngredientSerializer
    queryset = SupplierIngredient.objects.select_related("supplier", "ingredient")

