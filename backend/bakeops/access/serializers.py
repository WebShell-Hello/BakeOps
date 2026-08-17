from typing import Any

from rest_framework import serializers

from bakeops.access.models import Role
from bakeops.navigation.models import NavigationItem


class RoleSerializer(serializers.ModelSerializer[Role]):
    page_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=NavigationItem.objects.filter(
            item_type=NavigationItem.ItemType.PAGE,
            is_active=True,
        ),
        required=False,
        source="pages",
    )

    class Meta:
        model = Role
        fields = (
            "id",
            "code",
            "name",
            "description",
            "is_protected",
            "is_assignable",
            "anonymous_access_mode",
            "deleted_at",
            "page_ids",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("is_assignable", "deleted_at", "created_at", "updated_at")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        next_code = attrs.get("code", self.instance.code if self.instance else "")
        is_anonymous_role = next_code == Role.ANONYMOUS_ROLE_CODE

        if self.instance and self.instance.is_anonymous_access_role and next_code != Role.ANONYMOUS_ROLE_CODE:
            raise serializers.ValidationError({"code": "The anonymous user role code cannot be changed."})
        if not is_anonymous_role and attrs.get("anonymous_access_mode") not in (None, Role.AnonymousAccessMode.NONE):
            raise serializers.ValidationError(
                {"anonymous_access_mode": "Anonymous access mode is only available for the anonymous user role."}
            )
        if is_anonymous_role:
            attrs["is_protected"] = True
            attrs["anonymous_access_mode"] = attrs.get(
                "anonymous_access_mode",
                self.instance.anonymous_access_mode if self.instance else Role.AnonymousAccessMode.LOGIN_PAGE,
            )
        else:
            attrs["anonymous_access_mode"] = Role.AnonymousAccessMode.NONE
        return attrs

    def validate_page_ids(self, pages: list[NavigationItem]) -> list[NavigationItem]:
        if any(page.item_type != NavigationItem.ItemType.PAGE for page in pages):
            raise serializers.ValidationError("Roles can only be assigned page items.")
        return pages

    def to_representation(self, instance: Role) -> dict[str, Any]:
        representation = super().to_representation(instance)
        representation["page_ids"] = [str(page_id) for page_id in instance.pages.values_list("id", flat=True)]
        return representation
