from typing import ClassVar

from django.contrib.auth.models import AbstractUser
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import models
from django.db.models.functions import Lower

from bakeops.common.models import BaseModel
from bakeops.users.managers import UserManager


class User(BaseModel, AbstractUser):
    username = models.CharField(max_length=150, validators=(UnicodeUsernameValidator(),))
    email = models.EmailField(unique=True)
    is_protected = models.BooleanField(default=False)
    roles = models.ManyToManyField(
        "access.Role",
        blank=True,
        related_name="users",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = ["username"]

    objects = UserManager()  # type: ignore[assignment,misc]

    class Meta:
        ordering = ("username",)
        permissions = (("manage_users", "Can manage system users"),)
        constraints = (
            models.UniqueConstraint(Lower("email"), name="users_user_email_ci_unique"),
        )

    def __str__(self) -> str:
        return self.username


class UserPreference(BaseModel):
    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        BAKERY = "bakery", "Bakery"
        PINK = "pink", "Princess Pink"

    class Locale(models.TextChoices):
        CHINESE = "zh-CN", "Chinese (Simplified)"
        ENGLISH = "en-GB", "English (United Kingdom)"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preferences")
    theme = models.CharField(max_length=20, choices=Theme.choices, default=Theme.LIGHT)
    locale = models.CharField(max_length=10, choices=Locale.choices, default=Locale.CHINESE)
    timezone = models.CharField(max_length=64, default="Europe/London")
    date_format = models.CharField(max_length=24, default="DD/MM/YYYY")
    week_starts_on = models.PositiveSmallIntegerField(default=1)
    table_page_size = models.PositiveSmallIntegerField(default=10)
    sidebar_pinned = models.BooleanField(default=True)
    notification_settings = models.JSONField(default=dict, blank=True)
    contract_interaction_settings = models.JSONField(default=dict, blank=True)
    extra_settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("user__username",)

    def __str__(self) -> str:
        return f"Preferences for {self.user.username}"
