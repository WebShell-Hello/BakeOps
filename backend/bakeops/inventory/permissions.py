from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.access.permissions import has_request_permission, has_request_permissions


class CanManageInventory(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_request_permission(
            request,
            "inventory.manage_inventory",
            {"operations.inventory", "operations.inventory-receipts"},
        )


class CanManageProductionPlans(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_request_permissions(
            request,
            {"inventory.manage_production_plans", "inventory.manage_inventory"},
            {"planning.production", "operations.production"},
        )
