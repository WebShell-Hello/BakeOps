from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class CanManageEmployees(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            settings.DEBUG
            or (
                request.user.is_authenticated
                and request.user.is_active
                and request.user.has_perm("employees.manage_employees")
            )
        )
