from typing import Any

from rest_framework import serializers

from bakeops.navigation.models import NavigationItem, NavigationMenu


class NavigationMenuSerializer(serializers.ModelSerializer[NavigationMenu]):
    class Meta:
        model = NavigationMenu
        fields = (
            "id",
            "code",
            "name_zh",
            "name_en",
            "description",
            "revision",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("revision", "created_at", "updated_at")


class NavigationItemSerializer(serializers.ModelSerializer[NavigationItem]):
    parent_id = serializers.PrimaryKeyRelatedField(
        allow_null=True,
        queryset=NavigationItem.objects.all(),
        required=False,
        source="parent",
    )

    class Meta:
        model = NavigationItem
        fields = (
            "id",
            "menu_id",
            "parent_id",
            "item_type",
            "key",
            "label_zh",
            "label_en",
            "icon_key",
            "frontend_path",
            "position",
            "is_visible",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("menu_id", "position", "created_at", "updated_at")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        menu = self.context["menu"]
        instance = self.instance
        item_type = attrs.get("item_type", instance.item_type if instance else None)
        parent = attrs.get("parent", instance.parent if instance else None)
        frontend_path = attrs.get("frontend_path", instance.frontend_path if instance else None)

        if item_type == NavigationItem.ItemType.CATEGORY:
            if parent is not None:
                raise serializers.ValidationError({"parent_id": "A category must be a top-level item."})
            if frontend_path is not None:
                raise serializers.ValidationError({"frontend_path": "A category cannot have a frontend path."})
        elif item_type == NavigationItem.ItemType.PAGE:
            if not frontend_path:
                raise serializers.ValidationError({"frontend_path": "A page requires a frontend path."})
            if parent is not None:
                if parent.item_type != NavigationItem.ItemType.CATEGORY:
                    raise serializers.ValidationError({"parent_id": "A page parent must be a category."})
                if parent.menu_id != menu.id:
                    raise serializers.ValidationError({"parent_id": "The parent belongs to another menu."})

        return attrs


class NavigationReorderItemSerializer(serializers.Serializer[dict[str, Any]]):
    id = serializers.UUIDField()
    parent_id = serializers.UUIDField(allow_null=True)
    position = serializers.IntegerField(min_value=0)


class NavigationReorderSerializer(serializers.Serializer[dict[str, Any]]):
    revision = serializers.IntegerField(min_value=1)
    items = NavigationReorderItemSerializer(many=True, allow_empty=False)
