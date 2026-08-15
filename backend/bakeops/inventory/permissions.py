from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.access.permissions import has_django_or_role_permission, has_role_page_access


class CanManageInventory(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            settings.DEBUG
            or has_django_or_role_permission(
                request.user,
                "inventory.manage_inventory",
                {"operations.inventory", "operations.inventory-receipts"},
            )
        )


class CanManageProductionPlans(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            settings.DEBUG
            or (
                request.user.is_authenticated
                and request.user.is_active
                and (
                    request.user.has_perm("inventory.manage_production_plans")
                    or request.user.has_perm("inventory.manage_inventory")
                    or has_role_page_access(request.user, {"planning.production", "operations.production"})
                )
            )
        )
