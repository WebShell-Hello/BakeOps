from django.urls import path

from bakeops.users.views import (
    ChangePasswordApi,
    CsrfCookieApi,
    RegistrationApi,
    RegistrationCaptchaApi,
    SessionLoginApi,
    SessionLogoutApi,
    SessionUserApi,
    UserBulkDeleteApi,
    UserDetailApi,
    UserListCreateApi,
    UserLockApi,
    UserPasswordResetApi,
    UserPreferenceApi,
)

urlpatterns = [
    path("auth/csrf/", CsrfCookieApi.as_view(), name="auth-csrf"),
    path("auth/login/", SessionLoginApi.as_view(), name="auth-login"),
    path("auth/logout/", SessionLogoutApi.as_view(), name="auth-logout"),
    path("auth/me/", SessionUserApi.as_view(), name="auth-me"),
    path("auth/preferences/", UserPreferenceApi.as_view(), name="auth-preferences"),
    path("auth/registration-captcha/", RegistrationCaptchaApi.as_view(), name="auth-registration-captcha"),
    path("auth/register/", RegistrationApi.as_view(), name="auth-register"),
    path("auth/change-password/", ChangePasswordApi.as_view(), name="auth-change-password"),
    path("", UserListCreateApi.as_view(), name="user-list"),
    path("bulk-delete/", UserBulkDeleteApi.as_view(), name="user-bulk-delete"),
    path("<uuid:pk>/", UserDetailApi.as_view(), name="user-detail"),
    path("<uuid:pk>/lock/", UserLockApi.as_view(), name="user-lock"),
    path("<uuid:pk>/reset-password/", UserPasswordResetApi.as_view(), name="user-reset-password"),
]
