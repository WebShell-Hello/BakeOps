from django.conf import settings
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from bakeops.access.models import Role
from bakeops.users.constants import is_global_superuser


def has_role_page_access(user: object, page_keys: set[str]) -> bool:
    if is_global_superuser(user):
        return True
    if not getattr(user, "is_authenticated", False) or not getattr(user, "is_active", False):
        return False
    return bool(
        user.roles.filter(  # type: ignore[attr-defined]
            deleted_at__isnull=True,
            is_assignable=True,
            pages__key__in=page_keys,
            pages__item_type="PAGE",
            pages__is_active=True,
            pages__is_visible=True,
        ).exists()
    )


def has_anonymous_page_access(page_keys: set[str]) -> bool:
    return Role.objects.filter(
        code=Role.ANONYMOUS_ROLE_CODE,
        deleted_at__isnull=True,
        anonymous_access_mode=Role.AnonymousAccessMode.SYSTEM_PAGE,
        pages__key__in=page_keys,
        pages__item_type="PAGE",
        pages__is_active=True,
        pages__is_visible=True,
    ).exists()


def has_django_or_role_permission(user: object, permission: str, page_keys: set[str]) -> bool:
    return bool(
        getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
        and (user.has_perm(permission) or has_role_page_access(user, page_keys))  # type: ignore[attr-defined]
    )


def has_request_permissions(request: Request, permissions: set[str], page_keys: set[str]) -> bool:
    user = request.user
    is_authenticated = bool(getattr(user, "is_authenticated", False) and getattr(user, "is_active", False))
    if is_authenticated:
        return bool(
            settings.DEBUG
            or any(user.has_perm(permission) for permission in permissions)  # type: ignore[attr-defined]
            or has_role_page_access(user, page_keys)
        )
    if request.method in SAFE_METHODS:
        return has_anonymous_page_access(page_keys)
    return False


def has_request_permission(request: Request, permission: str, page_keys: set[str]) -> bool:
    return has_request_permissions(request, {permission}, page_keys)


class CanManageRoles(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_request_permission(request, "access.manage_roles", {"settings.roles-permissions"})
