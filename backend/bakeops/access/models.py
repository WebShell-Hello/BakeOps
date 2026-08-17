from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

from bakeops.common.models import BaseModel

role_code_validator = RegexValidator(
    regex=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    message="Use lowercase letters, numbers and single hyphens only.",
)


class Role(BaseModel):
    class AnonymousAccessMode(models.TextChoices):
        NONE = "NONE", "None"
        LOGIN_PAGE = "LOGIN_PAGE", "Login page"
        SYSTEM_PAGE = "SYSTEM_PAGE", "System page"

    ANONYMOUS_ROLE_CODE = "anonymous-user"

    code = models.CharField(max_length=64, unique=True, validators=[role_code_validator])
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_protected = models.BooleanField(default=False)
    is_assignable = models.BooleanField(default=True)
    anonymous_access_mode = models.CharField(
        max_length=16,
        choices=AnonymousAccessMode.choices,
        default=AnonymousAccessMode.NONE,
    )
    deleted_at = models.DateTimeField(blank=True, null=True)
    pages = models.ManyToManyField(
        "navigation.NavigationItem",
        blank=True,
        related_name="access_roles",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="roles_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="roles_updated",
    )

    class Meta:
        ordering = ("name", "code")
        indexes = (models.Index(fields=("deleted_at", "is_protected"), name="role_deletion_state_idx"),)
        permissions = (("manage_roles", "Can manage roles and page access"),)

    def __str__(self) -> str:
        return self.name

    @property
    def is_anonymous_access_role(self) -> bool:
        return self.code == self.ANONYMOUS_ROLE_CODE
