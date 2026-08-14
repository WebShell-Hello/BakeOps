from django.urls import path

from bakeops.access.views import RoleDetailApi, RoleListCreateApi, RoleRestoreApi

urlpatterns = [
    path("roles/", RoleListCreateApi.as_view(), name="role-list"),
    path("roles/<uuid:pk>/", RoleDetailApi.as_view(), name="role-detail"),
    path("roles/<uuid:pk>/restore/", RoleRestoreApi.as_view(), name="role-restore"),
]
