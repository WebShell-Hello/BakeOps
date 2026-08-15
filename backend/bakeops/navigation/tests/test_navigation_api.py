import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from bakeops.navigation.models import NavigationItem, NavigationMenu
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    user = User.objects.create_superuser(email="navigation-admin@example.com", password="test-password")
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def navigation_menu() -> NavigationMenu:
    menu = NavigationMenu.objects.create(code="test-sidebar", name_zh="测试侧边栏", name_en="Test Sidebar")
    category = NavigationItem.objects.create(
        menu=menu,
        item_type=NavigationItem.ItemType.CATEGORY,
        key="test-category",
        label_zh="测试分类",
        label_en="Test Category",
        position=0,
    )
    NavigationItem.objects.create(
        menu=menu,
        parent=category,
        item_type=NavigationItem.ItemType.PAGE,
        key="test-category.page",
        label_zh="测试页面",
        label_en="Test Page",
        frontend_path="/test/page",
        position=0,
    )
    return menu


@pytest.mark.django_db
def test_tree_returns_visible_navigation(admin_client: APIClient, navigation_menu: NavigationMenu) -> None:
    response = admin_client.get(reverse("navigation-tree", kwargs={"code": navigation_menu.code}))

    assert response.status_code == 200
    assert response.json()["items"][0]["key"] == "test-category"
    assert response.json()["items"][0]["children"][0]["frontend_path"] == "/test/page"


@pytest.mark.django_db
def test_category_disappears_when_its_only_page_is_hidden(
    admin_client: APIClient, navigation_menu: NavigationMenu
) -> None:
    page = NavigationItem.objects.get(menu=navigation_menu, item_type=NavigationItem.ItemType.PAGE)
    page.is_visible = False
    page.save(update_fields=("is_visible", "updated_at"))

    response = admin_client.get(reverse("navigation-tree", kwargs={"code": navigation_menu.code}))

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.django_db
def test_reorder_is_atomic_and_rejects_stale_revision(
    admin_client: APIClient, navigation_menu: NavigationMenu
) -> None:
    category = NavigationItem.objects.get(menu=navigation_menu, item_type=NavigationItem.ItemType.CATEGORY)
    page = NavigationItem.objects.get(menu=navigation_menu, item_type=NavigationItem.ItemType.PAGE)
    payload = {
        "revision": navigation_menu.revision,
        "items": [
            {"id": str(category.id), "parent_id": None, "position": 0},
            {"id": str(page.id), "parent_id": None, "position": 1},
        ],
    }

    first_response = admin_client.post(
        reverse("navigation-reorder", kwargs={"menu_id": navigation_menu.id}),
        payload,
        format="json",
    )
    stale_response = admin_client.post(
        reverse("navigation-reorder", kwargs={"menu_id": navigation_menu.id}),
        payload,
        format="json",
    )

    assert first_response.status_code == 200
    assert first_response.json()["revision"] == 2
    assert stale_response.status_code == 409
    page.refresh_from_db()
    assert page.parent_id is None
    assert page.position == 1


@pytest.mark.django_db
def test_reorder_moves_inactive_siblings_out_of_active_positions(
    admin_client: APIClient, navigation_menu: NavigationMenu
) -> None:
    category = NavigationItem.objects.get(menu=navigation_menu, item_type=NavigationItem.ItemType.CATEGORY)
    first_page = NavigationItem.objects.get(menu=navigation_menu, item_type=NavigationItem.ItemType.PAGE)
    inactive_page = NavigationItem.objects.create(
        menu=navigation_menu,
        parent=category,
        item_type=NavigationItem.ItemType.PAGE,
        key="test-category.hidden",
        label_zh="隐藏页面",
        label_en="Hidden Page",
        frontend_path="/test/hidden",
        position=1,
        is_active=False,
        is_visible=False,
    )
    second_page = NavigationItem.objects.create(
        menu=navigation_menu,
        parent=category,
        item_type=NavigationItem.ItemType.PAGE,
        key="test-category.second",
        label_zh="第二页面",
        label_en="Second Page",
        frontend_path="/test/second",
        position=2,
    )
    payload = {
        "revision": navigation_menu.revision,
        "items": [
            {"id": str(category.id), "parent_id": None, "position": 0},
            {"id": str(second_page.id), "parent_id": str(category.id), "position": 0},
            {"id": str(first_page.id), "parent_id": str(category.id), "position": 1},
        ],
    }

    response = admin_client.post(
        reverse("navigation-reorder", kwargs={"menu_id": navigation_menu.id}),
        payload,
        format="json",
    )

    assert response.status_code == 200
    first_page.refresh_from_db()
    second_page.refresh_from_db()
    inactive_page.refresh_from_db()
    assert second_page.position == 0
    assert first_page.position == 1
    assert inactive_page.position == 2


@pytest.mark.django_db
def test_anonymous_management_request_is_forbidden(navigation_menu: NavigationMenu) -> None:
    response = APIClient().get(reverse("navigation-item-list", kwargs={"menu_id": navigation_menu.id}))

    assert response.status_code == 403


@pytest.mark.django_db
def test_second_sidebar_cannot_be_created_through_api(admin_client: APIClient) -> None:
    response = admin_client.post(
        reverse("navigation-menu-list"),
        {"code": "second-sidebar", "name_zh": "第二侧边栏", "name_en": "Second Sidebar"},
        format="json",
    )

    assert response.status_code == 405
