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
            "deleted_at",
            "page_ids",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("deleted_at", "created_at", "updated_at")

    def validate_page_ids(self, pages: list[NavigationItem]) -> list[NavigationItem]:
        if any(page.item_type != NavigationItem.ItemType.PAGE for page in pages):
            raise serializers.ValidationError("Roles can only be assigned page items.")
        return pages

    def to_representation(self, instance: Role) -> dict[str, Any]:
        representation = super().to_representation(instance)
        representation["page_ids"] = [str(page_id) for page_id in instance.pages.values_list("id", flat=True)]
        return representation
