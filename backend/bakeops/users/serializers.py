from typing import Any

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import serializers

from bakeops.access.models import Role
from bakeops.users.captcha import consume_registration_captcha
from bakeops.users.models import User, UserPreference


class UserPreferenceSerializer(serializers.ModelSerializer[UserPreference]):
    class Meta:
        model = UserPreference
        fields = (
            "theme",
            "locale",
            "timezone",
            "date_format",
            "week_starts_on",
            "table_page_size",
            "sidebar_pinned",
            "notification_settings",
            "contract_interaction_settings",
            "extra_settings",
            "updated_at",
        )
        read_only_fields = ("updated_at",)

    def validate_week_starts_on(self, value: int) -> int:
        if value > 6:
            raise serializers.ValidationError("Week start must be between 0 and 6.")
        return value

    def validate_table_page_size(self, value: int) -> int:
        if value not in (5, 10, 20, 50, 100):
            raise serializers.ValidationError("Unsupported table page size.")
        return value


class UserSerializer(serializers.ModelSerializer[User]):
    role_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Role.objects.filter(deleted_at__isnull=True),
        required=False,
        source="roles",
    )
    effective_page_ids = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_protected",
            "is_superuser",
            "role_ids",
            "effective_page_ids",
            "last_login",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("is_superuser", "effective_page_ids", "last_login", "created_at", "updated_at")

    def validate_username(self, username: str) -> str:
        return username.strip()

    def validate_email(self, email: str) -> str:
        value = email.strip().lower()
        queryset = User.objects.filter(email__iexact=value)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if self.instance is not None and self.instance.is_superuser and attrs.get("is_active") is False:
            raise serializers.ValidationError({"is_active": "Superuser accounts cannot be locked."})
        return attrs

    def create(self, validated_data: dict[str, Any]) -> User:
        roles = validated_data.pop("roles", [])
        user = User.objects.create_user(password=settings.DEFAULT_USER_PASSWORD, **validated_data)
        user.roles.set(roles)
        return user

    def update(self, instance: User, validated_data: dict[str, Any]) -> User:
        roles = validated_data.pop("roles", None)
        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)
        instance.full_clean()
        instance.save()
        if roles is not None:
            instance.roles.set(roles)
        return instance

    def get_effective_page_ids(self, instance: User) -> list[str]:
        page_ids = instance.roles.filter(deleted_at__isnull=True).values_list("pages__id", flat=True)
        return sorted({str(page_id) for page_id in page_ids if page_id is not None})

    def to_representation(self, instance: User) -> dict[str, Any]:
        representation = super().to_representation(instance)
        representation["role_ids"] = [
            str(role_id)
            for role_id in instance.roles.filter(deleted_at__isnull=True).values_list("id", flat=True)
        ]
        return representation


class UserLockSerializer(serializers.Serializer[dict[str, bool]]):
    locked = serializers.BooleanField()


class BulkDeleteUsersSerializer(serializers.Serializer[dict[str, Any]]):
    user_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class SessionUserSerializer(serializers.ModelSerializer[User]):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    role_names = serializers.SerializerMethodField()
    preferences = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role_names",
            "preferences",
            "is_superuser",
        )

    def get_role_names(self, instance: User) -> list[str]:
        return list(
            instance.roles.filter(deleted_at__isnull=True)
            .order_by("name")
            .values_list("name", flat=True)
        )

    def get_preferences(self, instance: User) -> dict[str, Any]:
        preferences, _ = UserPreference.objects.get_or_create(user=instance)
        return UserPreferenceSerializer(preferences).data


class CurrentUserProfileSerializer(serializers.ModelSerializer[User]):
    class Meta:
        model = User
        fields = ("username", "first_name", "last_name")

    def validate_username(self, username: str) -> str:
        return username.strip()

    def validate_first_name(self, first_name: str) -> str:
        return first_name.strip()

    def validate_last_name(self, last_name: str) -> str:
        return last_name.strip()


class LoginSerializer(serializers.Serializer[dict[str, Any]]):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    remember = serializers.BooleanField(default=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        request = self.context["request"]
        user = authenticate(
            request=request,
            email=attrs["email"].strip().lower(),
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError({"detail": "Invalid email address or password."})
        if not user.is_active:
            raise serializers.ValidationError({"detail": "This account is locked."})
        attrs["user"] = user
        return attrs


class RegistrationSerializer(serializers.Serializer[dict[str, Any]]):
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    first_name = serializers.CharField(max_length=150, trim_whitespace=True)
    last_name = serializers.CharField(max_length=150, trim_whitespace=True)
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    captcha_id = serializers.CharField(write_only=True)
    captcha_answer = serializers.CharField(write_only=True, trim_whitespace=True)

    def validate_username(self, username: str) -> str:
        return username.strip()

    def validate_email(self, email: str) -> str:
        value = email.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        request = self.context["request"]
        if not consume_registration_captcha(request, attrs["captcha_id"], attrs["captcha_answer"]):
            raise serializers.ValidationError(
                {"captcha_answer": "The verification code is invalid or has expired."}
            )
        return attrs

    def create(self, validated_data: dict[str, Any]) -> User:
        validated_data.pop("captcha_id")
        validated_data.pop("captcha_answer")
        guest_role = Role.objects.filter(code="store-guest", deleted_at__isnull=True).first()
        if guest_role is None:
            raise serializers.ValidationError({"detail": "The default guest role is not configured."})

        with transaction.atomic():
            user = User.objects.create_user(**validated_data)
            user.roles.set((guest_role,))
        return user


class ChangePasswordSerializer(serializers.Serializer[dict[str, str]]):
    current_password = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)
    confirm_password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate_current_password(self, password: str) -> str:
        request = self.context["request"]
        if not request.user.check_password(password):
            raise serializers.ValidationError("The current password is incorrect.")
        return password

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "The passwords do not match."})
        if not attrs["new_password"]:
            raise serializers.ValidationError({"new_password": "The password cannot be empty."})
        return attrs
