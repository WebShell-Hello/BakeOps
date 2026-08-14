from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class CanManageEvents(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            settings.DEBUG
            or (
                request.user.is_authenticated
                and request.user.is_active
                and request.user.has_perm("events.manage_events")
            )
        )


class CanReadBusinessDayStatus(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            settings.DEBUG
            or (
                request.user.is_authenticated
                and request.user.is_active
                and (
                    request.user.has_perm("events.manage_events")
                    or request.user.has_perm("inventory.manage_production_plans")
                    or request.user.has_perm("inventory.manage_inventory")
                )
            )
        )
