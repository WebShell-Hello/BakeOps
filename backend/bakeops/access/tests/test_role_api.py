import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from bakeops.access.models import Role
from bakeops.navigation.models import NavigationItem, NavigationMenu
from bakeops.users.models import User


@pytest.fixture
def admin_client() -> APIClient:
    user = User.objects.create_superuser(email="role-admin@example.com", password="test-password")
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def navigation_page() -> NavigationItem:
    menu = NavigationMenu.objects.create(code="role-test", name_zh="角色测试", name_en="Role Test")
    category = NavigationItem.objects.create(
        menu=menu,
        item_type=NavigationItem.ItemType.CATEGORY,
        key="role-test-category",
        label_zh="测试分类",
        label_en="Test Category",
        position=0,
    )
    return NavigationItem.objects.create(
        menu=menu,
        parent=category,
        item_type=NavigationItem.ItemType.PAGE,
        key="role-test-category.page",
        label_zh="测试页面",
        label_en="Test Page",
        frontend_path="/role-test/page",
        position=0,
    )


@pytest.fixture
def roles_permission_page() -> NavigationItem:
    menu = NavigationMenu.objects.create(code="settings-test", name_zh="设置测试", name_en="Settings Test")
    category = NavigationItem.objects.create(
        menu=menu,
        item_type=NavigationItem.ItemType.CATEGORY,
        key="settings",
        label_zh="系统设置",
        label_en="Settings",
        position=0,
    )
    return NavigationItem.objects.create(
        menu=menu,
        parent=category,
        item_type=NavigationItem.ItemType.PAGE,
        key="settings.roles-permissions",
        label_zh="角色权限",
        label_en="Roles & Permissions",
        frontend_path="/settings/roles-permissions",
        position=0,
    )


@pytest.mark.django_db
def test_role_crud_persists_page_permissions(admin_client: APIClient, navigation_page: NavigationItem) -> None:
    create_response = admin_client.post(
        reverse("role-list"),
        {
            "code": "store-manager",
            "name": "Store Manager",
            "description": "Manages a store",
            "page_ids": [str(navigation_page.id)],
        },
        format="json",
    )

    assert create_response.status_code == 201
    role = Role.objects.get(code="store-manager")
    assert list(role.pages.values_list("id", flat=True)) == [navigation_page.id]

    update_response = admin_client.put(
        reverse("role-detail", kwargs={"pk": role.id}),
        {
            "code": "store-manager",
            "name": "Store Manager",
            "description": "Updated",
            "page_ids": [],
        },
        format="json",
    )

    assert update_response.status_code == 200
    role.refresh_from_db()
    assert role.description == "Updated"
    assert role.pages.count() == 0

    soft_delete_response = admin_client.delete(reverse("role-detail", kwargs={"pk": role.id}))
    assert soft_delete_response.status_code == 204
    role.refresh_from_db()
    assert role.deleted_at is not None

    restore_response = admin_client.post(reverse("role-restore", kwargs={"pk": role.id}))
    assert restore_response.status_code == 200
    role.refresh_from_db()
    assert role.deleted_at is None

    admin_client.delete(reverse("role-detail", kwargs={"pk": role.id}))
    permanent_delete_response = admin_client.delete(reverse("role-detail", kwargs={"pk": role.id}))
    assert permanent_delete_response.status_code == 204
    assert not Role.objects.filter(id=role.id).exists()


@pytest.mark.django_db
def test_role_page_permission_allows_non_superuser_to_manage_roles(
    roles_permission_page: NavigationItem,
) -> None:
    user = User.objects.create_user(email="role-manager@example.com", password="test-password")
    role = Role.objects.create(code="role-manager", name="Role Manager")
    role.pages.set([roles_permission_page])
    user.roles.set([role])
    client = APIClient()
    client.force_authenticate(user)

    response = client.get(reverse("role-list"))

    assert response.status_code == 200


@pytest.mark.django_db
def test_non_superuser_without_roles_page_cannot_manage_roles() -> None:
    user = User.objects.create_user(email="no-role-manager@example.com", password="test-password")
    client = APIClient()
    client.force_authenticate(user)

    response = client.get(reverse("role-list"))

    assert response.status_code == 403


@pytest.mark.django_db
def test_role_rejects_category_as_page_permission(
    admin_client: APIClient,
    navigation_page: NavigationItem,
) -> None:
    response = admin_client.post(
        reverse("role-list"),
        {
            "code": "invalid-role",
            "name": "Invalid Role",
            "page_ids": [str(navigation_page.parent_id)],
        },
        format="json",
    )

    assert response.status_code == 400
    assert not Role.objects.filter(code="invalid-role").exists()


@pytest.mark.django_db
def test_protected_role_cannot_be_deleted(admin_client: APIClient) -> None:
    role = Role.objects.create(code="system-admin", name="System Administrator", is_protected=True)

    response = admin_client.delete(reverse("role-detail", kwargs={"pk": role.id}))

    assert response.status_code == 400
    role.refresh_from_db()
    assert role.deleted_at is None


@pytest.mark.django_db
def test_anonymous_user_role_is_protected_and_configurable(
    admin_client: APIClient,
    navigation_page: NavigationItem,
) -> None:
    role = Role.objects.get(code=Role.ANONYMOUS_ROLE_CODE)

    update_response = admin_client.patch(
        reverse("role-detail", kwargs={"pk": role.id}),
        {
            "anonymous_access_mode": Role.AnonymousAccessMode.SYSTEM_PAGE,
            "page_ids": [str(navigation_page.id)],
        },
        format="json",
    )
    delete_response = admin_client.delete(reverse("role-detail", kwargs={"pk": role.id}))

    assert update_response.status_code == 200
    role.refresh_from_db()
    assert role.is_protected
    assert not role.is_assignable
    assert role.anonymous_access_mode == Role.AnonymousAccessMode.SYSTEM_PAGE
    assert list(role.pages.values_list("id", flat=True)) == [navigation_page.id]
    assert delete_response.status_code == 400
