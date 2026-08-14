from django.urls import path

from bakeops.navigation.views import (
    NavigationItemDetailApi,
    NavigationItemListCreateApi,
    NavigationMenuDetailApi,
    NavigationMenuListApi,
    NavigationReorderApi,
    NavigationTreeApi,
)

urlpatterns = [
    path("menus/", NavigationMenuListApi.as_view(), name="navigation-menu-list"),
    path("menus/<uuid:pk>/", NavigationMenuDetailApi.as_view(), name="navigation-menu-detail"),
    path(
        "menus/<uuid:menu_id>/items/",
        NavigationItemListCreateApi.as_view(),
        name="navigation-item-list",
    ),
    path("items/<uuid:pk>/", NavigationItemDetailApi.as_view(), name="navigation-item-detail"),
    path(
        "menus/<uuid:menu_id>/reorder/",
        NavigationReorderApi.as_view(),
        name="navigation-reorder",
    ),
    path("menus/<slug:code>/tree/", NavigationTreeApi.as_view(), name="navigation-tree"),
]
