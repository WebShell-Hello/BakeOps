from typing import Any
from uuid import UUID

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from bakeops.navigation.models import NavigationItem, NavigationMenu
from bakeops.navigation.permissions import CanManageNavigation, CanReadNavigation
from bakeops.navigation.serializers import (
    NavigationItemSerializer,
    NavigationMenuSerializer,
    NavigationReorderSerializer,
)
from bakeops.navigation.services import (
    NavigationReorderValidationError,
    NavigationRevisionConflictError,
    build_navigation_tree,
    next_navigation_position,
    reorder_navigation_items,
)


class NavigationConflictApiError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The menu changed since it was loaded. Refresh and try again."
    default_code = "navigation_revision_conflict"


def authenticated_user_or_none(request: Request) -> Any:
    return request.user if request.user.is_authenticated else None


class NavigationMenuListApi(generics.ListAPIView[NavigationMenu]):
    permission_classes = (CanManageNavigation,)
    serializer_class = NavigationMenuSerializer
    queryset = NavigationMenu.objects.all()
    pagination_class = None

class NavigationMenuDetailApi(generics.RetrieveUpdateAPIView[NavigationMenu]):
    permission_classes = (CanManageNavigation,)
    serializer_class = NavigationMenuSerializer
    queryset = NavigationMenu.objects.all()

    def perform_update(self, serializer: BaseSerializer[NavigationMenu]) -> None:
        serializer.save(updated_by=authenticated_user_or_none(self.request))


class NavigationItemListCreateApi(generics.ListCreateAPIView[NavigationItem]):
    permission_classes = (CanManageNavigation,)
    serializer_class = NavigationItemSerializer
    pagination_class = None

    def get_menu(self) -> NavigationMenu:
        return get_object_or_404(NavigationMenu, id=self.kwargs["menu_id"])

    def get_queryset(self) -> Any:
        return NavigationItem.objects.filter(menu=self.get_menu(), is_active=True).select_related("parent")

    def get_serializer_context(self) -> dict[str, Any]:
        return {**super().get_serializer_context(), "menu": self.get_menu()}

    @transaction.atomic
    def perform_create(self, serializer: BaseSerializer[NavigationItem]) -> None:
        menu = NavigationMenu.objects.select_for_update().get(id=self.get_menu().id)
        parent = serializer.validated_data.get("parent")
        actor = authenticated_user_or_none(self.request)
        item = serializer.save(
            menu=menu,
            position=next_navigation_position(menu, parent),
            created_by=actor,
            updated_by=actor,
        )
        item.full_clean()
        menu.revision += 1
        menu.updated_by = actor
        menu.save(update_fields=("revision", "updated_by", "updated_at"))


class NavigationItemDetailApi(generics.RetrieveUpdateAPIView[NavigationItem]):
    permission_classes = (CanManageNavigation,)
    serializer_class = NavigationItemSerializer
    queryset = NavigationItem.objects.select_related("menu", "parent")

    def get_serializer_context(self) -> dict[str, Any]:
        return {**super().get_serializer_context(), "menu": self.get_object().menu}

    @transaction.atomic
    def perform_update(self, serializer: BaseSerializer[NavigationItem]) -> None:
        item = NavigationItem.objects.select_for_update().select_related("menu").get(id=self.get_object().id)
        menu = NavigationMenu.objects.select_for_update().get(id=item.menu_id)
        next_parent = serializer.validated_data.get("parent", item.parent)
        if next_parent != item.parent:
            serializer.validated_data["position"] = next_navigation_position(menu, next_parent)
        actor = authenticated_user_or_none(self.request)
        updated_item = serializer.save(updated_by=actor)
        updated_item.full_clean()
        menu.revision += 1
        menu.updated_by = actor
        menu.save(update_fields=("revision", "updated_by", "updated_at"))


class NavigationReorderApi(APIView):
    permission_classes = (CanManageNavigation,)

    def post(self, request: Request, menu_id: UUID) -> Response:
        serializer = NavigationReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            menu = reorder_navigation_items(
                menu_id=menu_id,
                expected_revision=serializer.validated_data["revision"],
                requested_items=serializer.validated_data["items"],
            )
        except NavigationRevisionConflictError as error:
            raise NavigationConflictApiError from error
        except NavigationReorderValidationError as error:
            raise ValidationError({"items": str(error)}) from error

        return Response(NavigationMenuSerializer(menu).data)


class NavigationTreeApi(APIView):
    permission_classes = (CanReadNavigation,)

    def get(self, request: Request, code: str) -> Response:
        menu = get_object_or_404(NavigationMenu, code=code, is_active=True)
        return Response(
            {
                "id": menu.id,
                "code": menu.code,
                "name_zh": menu.name_zh,
                "name_en": menu.name_en,
                "revision": menu.revision,
                "items": build_navigation_tree(menu),
            }
        )
