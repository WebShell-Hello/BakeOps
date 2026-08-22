from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.users.constants import is_global_superuser


class IsGlobalSuperuser(BasePermission):
    message = "Only the global super administrator can export production data."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return is_global_superuser(request.user)
