from typing import Any

from django.conf import settings
from django.contrib.auth import login, logout, update_session_auth_hash
from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from bakeops.users.captcha import create_registration_captcha
from bakeops.users.models import User, UserPreference
from bakeops.users.permissions import CanManageUsers
from bakeops.users.serializers import (
    BulkDeleteUsersSerializer,
    ChangePasswordSerializer,
    CurrentUserProfileSerializer,
    LoginSerializer,
    RegistrationSerializer,
    SessionUserSerializer,
    UserLockSerializer,
    UserPreferenceSerializer,
    UserSerializer,
)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfCookieApi(APIView):
    permission_classes = (AllowAny,)
    authentication_classes: tuple = ()

    def get(self, request: Request) -> Response:
        return Response({"detail": "CSRF cookie set."})


@method_decorator(csrf_protect, name="dispatch")
class SessionLoginApi(generics.GenericAPIView[User]):
    permission_classes = (AllowAny,)
    authentication_classes: tuple = ()
    serializer_class = LoginSerializer

    def post(self, request: Request) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        request.session.set_expiry(settings.SESSION_COOKIE_AGE if serializer.validated_data["remember"] else 0)
        return Response(SessionUserSerializer(user).data)


class SessionLogoutApi(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionUserApi(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        user = User.objects.prefetch_related("roles").get(pk=request.user.pk)
        return Response(SessionUserSerializer(user).data)

    def patch(self, request: Request) -> Response:
        user = User.objects.prefetch_related("roles").get(pk=request.user.pk)
        serializer = CurrentUserProfileSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SessionUserSerializer(user).data)


class RegistrationCaptchaApi(APIView):
    permission_classes = (AllowAny,)
    authentication_classes: tuple = ()

    def get(self, request: Request) -> Response:
        return Response(create_registration_captcha(request))


class UserPreferenceApi(generics.RetrieveUpdateAPIView[UserPreference]):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserPreferenceSerializer

    def get_object(self) -> UserPreference:
        preferences, _ = UserPreference.objects.get_or_create(user=self.request.user)
        return preferences


@method_decorator(csrf_protect, name="dispatch")
class RegistrationApi(generics.GenericAPIView[User]):
    permission_classes = (AllowAny,)
    authentication_classes: tuple = ()
    serializer_class = RegistrationSerializer

    def post(self, request: Request) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        request.session.set_expiry(0)
        return Response(SessionUserSerializer(user).data, status=status.HTTP_201_CREATED)


class ChangePasswordApi(generics.GenericAPIView[User]):
    permission_classes = (IsAuthenticated,)
    serializer_class = ChangePasswordSerializer

    def post(self, request: Request) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=("password", "updated_at"))
        update_session_auth_hash(request, user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserListCreateApi(generics.ListCreateAPIView[User]):
    permission_classes = (CanManageUsers,)
    serializer_class = UserSerializer
    pagination_class = None

    def get_queryset(self) -> Any:
        queryset = User.objects.prefetch_related("roles", "roles__pages").order_by("username")
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        return queryset


class UserDetailApi(generics.RetrieveUpdateDestroyAPIView[User]):
    permission_classes = (CanManageUsers,)
    serializer_class = UserSerializer
    queryset = User.objects.prefetch_related("roles", "roles__pages")

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        user = self.get_object()
        self._validate_deletion(user, request)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _validate_deletion(user: User, request: Request) -> None:
        if user.is_superuser:
            raise ValidationError({"detail": "Superuser accounts cannot be deleted."})
        if user.is_protected:
            raise ValidationError({"detail": "This user is protected and cannot be deleted."})
        if request.user.is_authenticated and user.pk == request.user.pk:
            raise ValidationError({"detail": "You cannot delete your own account."})


class UserPasswordResetApi(generics.GenericAPIView[User]):
    permission_classes = (CanManageUsers,)
    queryset = User.objects.all()

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        user = self.get_object()
        user.set_password(settings.DEFAULT_USER_PASSWORD)
        user.save(update_fields=("password", "updated_at"))
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserLockApi(generics.GenericAPIView[User]):
    permission_classes = (CanManageUsers,)
    serializer_class = UserLockSerializer
    queryset = User.objects.all()

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        user = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        locked = serializer.validated_data["locked"]
        if locked and user.is_superuser:
            raise ValidationError({"detail": "Superuser accounts cannot be locked."})
        if locked and request.user.is_authenticated and user.pk == request.user.pk:
            raise ValidationError({"detail": "You cannot lock your own account."})
        user.is_active = not locked
        user.save(update_fields=("is_active", "updated_at"))
        return Response(UserSerializer(user).data)


class UserBulkDeleteApi(generics.GenericAPIView[User]):
    permission_classes = (CanManageUsers,)
    serializer_class = BulkDeleteUsersSerializer

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        users = list(User.objects.filter(id__in=serializer.validated_data["user_ids"]))
        for user in users:
            UserDetailApi._validate_deletion(user, request)
        User.objects.filter(id__in=[user.id for user in users]).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
