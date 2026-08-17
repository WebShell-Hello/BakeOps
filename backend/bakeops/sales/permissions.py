from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.access.permissions import has_request_permission


class CanManageSales(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_request_permission(
            request,
            "sales.manage_sales",
            {"analytics.sales", "analytics.profitability", "operations.sales"},
        )
