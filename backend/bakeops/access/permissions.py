from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


def has_role_page_access(user: object, page_keys: set[str]) -> bool:
    if not getattr(user, "is_authenticated", False) or not getattr(user, "is_active", False):
        return False
    return bool(
        user.roles.filter(  # type: ignore[attr-defined]
            deleted_at__isnull=True,
            pages__key__in=page_keys,
            pages__item_type="PAGE",
            pages__is_active=True,
            pages__is_visible=True,
        ).exists()
    )


def has_django_or_role_permission(user: object, permission: str, page_keys: set[str]) -> bool:
    return bool(
        getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
        and (user.has_perm(permission) or has_role_page_access(user, page_keys))  # type: ignore[attr-defined]
    )


class CanManageRoles(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            settings.DEBUG
            or has_django_or_role_permission(
                request.user,
                "access.manage_roles",
                {"settings.roles-permissions"},
            )
        )
