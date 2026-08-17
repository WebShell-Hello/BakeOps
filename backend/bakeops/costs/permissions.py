from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.access.permissions import has_request_permission


class CanManageCosts(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_request_permission(request, "costs.manage_costs", {"analytics.costs"})
