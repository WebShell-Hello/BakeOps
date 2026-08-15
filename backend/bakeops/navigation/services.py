from collections import defaultdict
from collections.abc import Iterable
from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import Max

from bakeops.navigation.models import NavigationItem, NavigationMenu


class NavigationRevisionConflictError(Exception):
    pass


class NavigationReorderValidationError(Exception):
    pass


def next_navigation_position(menu: NavigationMenu, parent: NavigationItem | None) -> int:
    maximum = NavigationItem.objects.filter(menu=menu, parent=parent, is_active=True).aggregate(
        maximum=Max("position")
    )["maximum"]
    return 0 if maximum is None else int(maximum) + 1


def role_page_ids_for(user: Any) -> set[UUID]:
    if not user or not user.is_authenticated or not user.is_active:
        return set()
    return {
        page_id
        for page_id in user.roles.filter(deleted_at__isnull=True).values_list("pages__id", flat=True)
        if page_id is not None
    }


def build_navigation_tree(menu: NavigationMenu, user: Any | None = None) -> list[dict[str, Any]]:
    allowed_page_ids = role_page_ids_for(user)
    items = list(
        menu.items.filter(is_active=True, is_visible=True)
        .select_related("parent")
        .order_by("position", "created_at")
    )
    children_by_parent: dict[UUID | None, list[NavigationItem]] = defaultdict(list)
    for item in items:
        children_by_parent[item.parent_id].append(item)

    def serialize_item(item: NavigationItem) -> dict[str, Any] | None:
        children = [serialized for child in children_by_parent[item.id] if (serialized := serialize_item(child))]
        if item.item_type == NavigationItem.ItemType.PAGE and item.id not in allowed_page_ids:
            return None
        if item.item_type == NavigationItem.ItemType.CATEGORY and not children:
            return None
        return {
            "id": item.id,
            "key": item.key,
            "item_type": item.item_type,
            "label_zh": item.label_zh,
            "label_en": item.label_en,
            "icon_key": item.icon_key,
            "frontend_path": item.frontend_path,
            "position": item.position,
            "children": children,
        }

    return [serialized for item in children_by_parent[None] if (serialized := serialize_item(item))]


@transaction.atomic
def reorder_navigation_items(
    *,
    menu_id: UUID,
    expected_revision: int,
    requested_items: Iterable[dict[str, Any]],
) -> NavigationMenu:
    menu = NavigationMenu.objects.select_for_update().get(id=menu_id)
    if menu.revision != expected_revision:
        raise NavigationRevisionConflictError

    all_items = list(NavigationItem.objects.select_for_update().filter(menu=menu))
    existing_items = [item for item in all_items if item.is_active]
    inactive_items = [item for item in all_items if not item.is_active]
    inactive_original_positions = {item.id: item.position for item in inactive_items}
    existing_by_id = {item.id: item for item in existing_items}
    requested = list(requested_items)
    requested_ids = [item["id"] for item in requested]

    if len(requested_ids) != len(set(requested_ids)) or set(requested_ids) != set(existing_by_id):
        raise NavigationReorderValidationError("The reorder payload must contain every active menu item exactly once.")

    category_ids = {
        item.id for item in existing_items if item.item_type == NavigationItem.ItemType.CATEGORY
    }
    positions_by_parent: dict[UUID | None, set[int]] = defaultdict(set)

    for requested_item in requested:
        item = existing_by_id[requested_item["id"]]
        parent_id = requested_item["parent_id"]
        position = requested_item["position"]

        if item.item_type == NavigationItem.ItemType.CATEGORY and parent_id is not None:
            raise NavigationReorderValidationError("A category cannot be moved below another item.")
        if item.item_type == NavigationItem.ItemType.PAGE and parent_id is not None and parent_id not in category_ids:
            raise NavigationReorderValidationError("A page can only be moved below a category in the same menu.")
        if position in positions_by_parent[parent_id]:
            raise NavigationReorderValidationError("Sibling positions must be unique.")
        positions_by_parent[parent_id].add(position)

    temporary_start = 1_000_000
    for index, item in enumerate(all_items):
        item.position = temporary_start + index
        item.save(update_fields=("position", "updated_at"))

    occupied_by_parent: dict[UUID | None, set[int]] = defaultdict(set)
    for requested_item in requested:
        item = existing_by_id[requested_item["id"]]
        item.parent_id = requested_item["parent_id"]
        item.position = requested_item["position"]
        item.save(update_fields=("parent", "position", "updated_at"))
        occupied_by_parent[item.parent_id].add(item.position)

    inactive_by_parent: dict[UUID | None, list[NavigationItem]] = defaultdict(list)
    for item in inactive_items:
        inactive_by_parent[item.parent_id].append(item)
    for parent_id, siblings in inactive_by_parent.items():
        siblings.sort(key=lambda item: (inactive_original_positions[item.id], item.created_at))
        next_position = max(occupied_by_parent[parent_id], default=-1) + 1
        for item in siblings:
            item.position = next_position
            item.save(update_fields=("position", "updated_at"))
            next_position += 1

    menu.revision += 1
    menu.save(update_fields=("revision", "updated_at"))
    return menu
