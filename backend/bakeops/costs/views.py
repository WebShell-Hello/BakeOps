from decimal import Decimal
from typing import Any

from django.db import transaction
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from bakeops.costs.models import CostItem, MonthlyCost
from bakeops.costs.permissions import CanManageCosts
from bakeops.costs.serializers import (
    CostItemSerializer,
    MonthlyCostBatchSerializer,
    MonthlyCostSerializer,
)
from bakeops.costs.services import (
    ensure_cost_month,
    monthly_costs_with_materials,
    next_month,
    parse_month,
    wage_summary,
)


def actor_or_none(request: Request) -> Any:
    return request.user if request.user.is_authenticated else None


def requested_month(request: Request):
    try:
        return parse_month(request.query_params.get("month"))
    except ValueError as error:
        raise ValidationError({"month": str(error)}) from error


class CostItemListCreateApi(generics.ListCreateAPIView[CostItem]):
    permission_classes = (CanManageCosts,)
    serializer_class = CostItemSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = CostItem.objects.all()
        if self.request.query_params.get("include_inactive") != "true":
            queryset = queryset.filter(is_active=True)
        return queryset


class CostItemDetailApi(generics.RetrieveUpdateDestroyAPIView[CostItem]):
    permission_classes = (CanManageCosts,)
    serializer_class = CostItemSerializer
    queryset = CostItem.objects.all()

    def perform_destroy(self, instance: CostItem) -> None:
        if instance.monthly_costs.exists():
            raise ValidationError(
                {"detail": "Cost items with historical monthly costs cannot be deleted. Disable them instead."}
            )
        instance.delete()


class MonthlyCostListCreateApi(generics.ListCreateAPIView[MonthlyCost]):
    permission_classes = (CanManageCosts,)
    serializer_class = MonthlyCostSerializer
    pagination_class = None

    def get_queryset(self):
        month = requested_month(self.request)
        ensure_cost_month(month)
        return MonthlyCost.objects.filter(
            incurred_date__gte=month,
            incurred_date__lt=next_month(month),
        ).select_related("cost_item")

    def perform_create(self, serializer: BaseSerializer[MonthlyCost]) -> None:
        actor = actor_or_none(self.request)
        serializer.save(created_by=actor, updated_by=actor)


class MonthlyCostDetailApi(generics.RetrieveUpdateDestroyAPIView[MonthlyCost]):
    permission_classes = (CanManageCosts,)
    serializer_class = MonthlyCostSerializer
    queryset = MonthlyCost.objects.select_related("cost_item")

    def perform_update(self, serializer: BaseSerializer[MonthlyCost]) -> None:
        if serializer.instance.category == CostItem.Category.MATERIALS:
            raise ValidationError({"detail": "Ingredients and materials is calculated from production."})
        serializer.save(updated_by=actor_or_none(self.request))

    def perform_destroy(self, instance: MonthlyCost) -> None:
        if instance.category == CostItem.Category.MATERIALS:
            raise ValidationError({"detail": "Ingredients and materials is calculated from production."})
        instance.delete()


class CostOverviewApi(APIView):
    permission_classes = (CanManageCosts,)

    def get(self, request: Request) -> Response:
        month = requested_month(request)
        costs, material_summary = monthly_costs_with_materials(month)
        manual_costs = [
            cost
            for cost in costs
            if cost.category != CostItem.Category.MATERIALS and cost.amount > 0
        ]
        material_costs = [cost for cost in costs if cost.category == CostItem.Category.MATERIALS]
        display_costs = [*manual_costs, *material_costs[:1]]
        manual_total = sum((cost.amount for cost in manual_costs), start=Decimal("0.00"))
        other_total = manual_total + material_summary["total"]
        wages = wage_summary(month)
        total = wages["total"] + other_total
        return Response(
            {
                "month": month.strftime("%Y-%m"),
                "summary": {
                    "total_cost": f"{total:.2f}",
                    "employee_wages": f"{wages['total']:.2f}",
                    "other_costs": f"{other_total:.2f}",
                },
                "wage_entry": {
                    "source": "SCHEDULE",
                    "amount": f"{wages['total']:.2f}",
                    "employee_count": len(wages["employees"]),
                    "notes": "Calculated from schedules and current employee hourly rates.",
                },
                "manual_costs": MonthlyCostSerializer(display_costs, many=True).data,
            }
        )


class WageDetailApi(APIView):
    permission_classes = (CanManageCosts,)

    def get(self, request: Request) -> Response:
        month = requested_month(request)
        wages = wage_summary(month)
        return Response(
            {
                "month": month.strftime("%Y-%m"),
                "total": f"{wages['total']:.2f}",
                "employees": wages["employees"],
            }
        )


class MonthlyCostBatchUpdateApi(APIView):
    permission_classes = (CanManageCosts,)

    def get(self, request: Request) -> Response:
        month = requested_month(request)
        costs, _ = monthly_costs_with_materials(month)
        return Response(MonthlyCostSerializer(costs, many=True).data)

    def post(self, request: Request) -> Response:
        month = requested_month(request)
        ensure_cost_month(month)
        data = request.data.copy()
        data["incurred_date"] = month.isoformat()
        data["amount"] = data.get("amount") or "0.00"
        serializer = MonthlyCostSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        actor = actor_or_none(request)
        instance = serializer.save(created_by=actor, updated_by=actor)
        return Response(MonthlyCostSerializer(instance).data, status=201)

    @transaction.atomic
    def put(self, request: Request) -> Response:
        month = requested_month(request)
        ensure_cost_month(month)
        serializer = MonthlyCostBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        actor = actor_or_none(request)

        for item in serializer.validated_data["items"]:
            monthly_cost = item["monthly_cost"]
            amount = item["amount"]
            if monthly_cost.cost_month != month:
                raise ValidationError({"items": "A cost item does not belong to the selected month."})
            if monthly_cost.category == CostItem.Category.MATERIALS:
                raise ValidationError(
                    {"items": "Ingredients and materials is calculated automatically from production."}
                )
            monthly_cost.amount = amount
            monthly_cost.updated_by = actor
            monthly_cost.save(update_fields=("amount", "cost_month", "updated_by", "updated_at"))

        return Response(status=204)
