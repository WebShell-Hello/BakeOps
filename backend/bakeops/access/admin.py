from django.contrib import admin

from bakeops.access.models import Role


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name", "code", "is_protected", "deleted_at", "updated_at")
    list_filter = ("is_protected", "deleted_at")
    search_fields = ("name", "code", "description")
    filter_horizontal = ("pages",)
