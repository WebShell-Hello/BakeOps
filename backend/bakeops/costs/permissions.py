from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.access.permissions import has_django_or_role_permission


class CanManageCosts(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            settings.DEBUG
            or has_django_or_role_permission(request.user, "costs.manage_costs", {"analytics.costs"})
        )
