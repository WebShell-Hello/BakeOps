from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.access.permissions import has_request_permission, has_request_permissions


class CanManageEvents(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_request_permission(request, "events.manage_events", {"planning.calendar-events"})


class CanManageActivityPlans(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_request_permissions(
            request,
            {"events.manage_events", "events.manage_activity_plans"},
            {"planning.marketing"},
        )


class CanReadBusinessDayStatus(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_request_permissions(
            request,
            {"events.manage_events", "inventory.manage_production_plans", "inventory.manage_inventory"},
            {"planning.calendar-events", "planning.production", "operations.inventory"},
        )
