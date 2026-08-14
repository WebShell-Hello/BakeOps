from django.contrib import admin

from bakeops.navigation.models import NavigationItem, NavigationMenu


class NavigationItemInline(admin.TabularInline):  # type: ignore[type-arg]
    model = NavigationItem
    extra = 0
    fields = ("item_type", "key", "label_en", "parent", "frontend_path", "position", "is_visible", "is_active")


@admin.register(NavigationMenu)
class NavigationMenuAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name_en", "code", "revision", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name_en", "name_zh")
    inlines = (NavigationItemInline,)


@admin.register(NavigationItem)
class NavigationItemAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("label_en", "item_type", "menu", "parent", "position", "is_visible", "is_active")
    list_filter = ("menu", "item_type", "is_visible", "is_active")
    search_fields = ("key", "label_en", "label_zh", "frontend_path")
