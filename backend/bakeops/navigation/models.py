from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q

from bakeops.common.models import BaseModel

menu_code_validator = RegexValidator(
    regex=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    message="Use lowercase letters, numbers and single hyphens only.",
)
item_key_validator = RegexValidator(
    regex=r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$",
    message="Use lowercase letters, numbers, dots, underscores or hyphens only.",
)
frontend_path_validator = RegexValidator(
    regex=r"^/(?:[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*)?/?$",
    message="Enter an internal path beginning with / and without a query string or fragment.",
)


class NavigationMenu(BaseModel):
    code = models.CharField(max_length=64, unique=True, validators=[menu_code_validator])
    name_zh = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    revision = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="navigation_menus_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="navigation_menus_updated",
    )

    class Meta:
        ordering = ("name_en", "code")
        permissions = (("manage_navigation", "Can manage navigation menus"),)

    def __str__(self) -> str:
        return self.name_en


class NavigationItem(BaseModel):
    class ItemType(models.TextChoices):
        CATEGORY = "CATEGORY", "Category"
        PAGE = "PAGE", "Page"

    menu = models.ForeignKey(NavigationMenu, on_delete=models.PROTECT, related_name="items")
    parent = models.ForeignKey(
        "self",
        blank=True,
        null=True,
        on_delete=models.PROTECT,
        related_name="children",
    )
    item_type = models.CharField(max_length=16, choices=ItemType.choices)
    key = models.CharField(max_length=100, validators=[item_key_validator])
    label_zh = models.CharField(max_length=100)
    label_en = models.CharField(max_length=100)
    icon_key = models.CharField(max_length=64, blank=True)
    frontend_path = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        validators=[frontend_path_validator],
    )
    position = models.PositiveIntegerField(default=0)
    is_visible = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="navigation_items_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="navigation_items_updated",
    )

    class Meta:
        ordering = ("position", "created_at")
        indexes = (
            models.Index(fields=("menu", "parent", "position"), name="nav_item_tree_order_idx"),
            models.Index(fields=("menu", "is_active", "is_visible"), name="nav_item_state_idx"),
        )
        constraints = (
            models.UniqueConstraint(fields=("menu", "key"), name="unique_navigation_item_key_per_menu"),
            models.UniqueConstraint(
                fields=("menu", "frontend_path"),
                condition=Q(frontend_path__isnull=False),
                name="unique_navigation_path_per_menu",
            ),
            models.UniqueConstraint(
                fields=("menu", "position"),
                condition=Q(parent__isnull=True),
                name="unique_top_level_navigation_position",
            ),
            models.UniqueConstraint(
                fields=("parent", "position"),
                condition=Q(parent__isnull=False),
                name="unique_child_navigation_position",
            ),
            models.CheckConstraint(
                condition=(
                    Q(item_type="CATEGORY", parent__isnull=True, frontend_path__isnull=True)
                    | Q(item_type="PAGE", frontend_path__isnull=False)
                ),
                name="valid_navigation_item_shape",
            ),
        )

    def clean(self) -> None:
        errors: dict[str, str] = {}

        if self.item_type == self.ItemType.CATEGORY:
            if self.parent_id is not None:
                errors["parent"] = "A category must be a top-level item."
            if self.frontend_path is not None:
                errors["frontend_path"] = "A category cannot have a frontend path."
        elif self.item_type == self.ItemType.PAGE:
            if not self.frontend_path:
                errors["frontend_path"] = "A page requires a frontend path."
            if self.parent_id is not None:
                parent = self.parent
                if self.parent_id == self.id:
                    errors["parent"] = "An item cannot be its own parent."
                elif parent is None or parent.item_type != self.ItemType.CATEGORY:
                    errors["parent"] = "A page parent must be a category."
                elif parent.menu_id != self.menu_id:
                    errors["parent"] = "A page and its parent must belong to the same menu."

        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return self.label_en
