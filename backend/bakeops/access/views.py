from typing import Any

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from bakeops.access.models import Role
from bakeops.access.permissions import CanManageRoles
from bakeops.access.serializers import RoleSerializer


def authenticated_user_or_none(request: Request) -> Any:
    return request.user if request.user.is_authenticated else None


class RoleListCreateApi(generics.ListCreateAPIView[Role]):
    permission_classes = (CanManageRoles,)
    serializer_class = RoleSerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        return Role.objects.prefetch_related("pages")

    def perform_create(self, serializer: BaseSerializer[Role]) -> None:
        actor = authenticated_user_or_none(self.request)
        serializer.save(created_by=actor, updated_by=actor)


class RoleDetailApi(generics.RetrieveUpdateDestroyAPIView[Role]):
    permission_classes = (CanManageRoles,)
    serializer_class = RoleSerializer
    queryset = Role.objects.prefetch_related("pages")

    def perform_update(self, serializer: BaseSerializer[Role]) -> None:
        if self.get_object().deleted_at is not None:
            raise ValidationError({"detail": "Restore a deleted role before editing it."})
        serializer.save(updated_by=authenticated_user_or_none(self.request))

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        role = self.get_object()
        if role.is_protected:
            raise ValidationError({"detail": "This role is protected and cannot be deleted."})

        if role.deleted_at is None:
            role.deleted_at = timezone.now()
            role.updated_by = authenticated_user_or_none(request)
            role.save(update_fields=("deleted_at", "updated_by", "updated_at"))
        else:
            role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoleRestoreApi(generics.GenericAPIView[Role]):
    permission_classes = (CanManageRoles,)
    serializer_class = RoleSerializer
    queryset = Role.objects.prefetch_related("pages")

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        role = self.get_object()
        if role.deleted_at is not None:
            role.deleted_at = None
            role.updated_by = authenticated_user_or_none(request)
            role.save(update_fields=("deleted_at", "updated_by", "updated_at"))
        return Response(self.get_serializer(role).data)
