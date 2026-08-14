from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from bakeops.users.models import User, UserPreference


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("user", "theme", "locale", "timezone", "table_page_size", "updated_at")
    list_select_related = ("user",)
    search_fields = ("user__username", "user__email")


@admin.register(User)
class BakeOpsUserAdmin(UserAdmin):  # type: ignore[type-arg]
    ordering = ("username",)
    list_display = ("username", "email", "first_name", "last_name", "is_staff", "is_active")
    fieldsets = (
        (None, {"fields": ("username", "email", "password")}),
        ("Personal information", {"fields": ("first_name", "last_name")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_protected",
                    "is_staff",
                    "is_superuser",
                    "roles",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                    "is_protected",
                ),
            },
        ),
    )
    filter_horizontal = ("roles", "groups", "user_permissions")
    search_fields = ("username", "email", "first_name", "last_name")
