from unittest.mock import patch

import pytest
from django.contrib.auth import authenticate
from django.urls import reverse
from rest_framework.test import APIClient

from bakeops.access.models import Role
from bakeops.navigation.models import NavigationItem, NavigationMenu
from bakeops.users.models import User, UserPreference


def issue_registration_captcha(client: APIClient, code: str = "1234") -> str:
    with patch("bakeops.users.captcha.generate_numeric_code", return_value=code):
        response = client.get(reverse("auth-registration-captcha"))
    assert response.status_code == 200
    assert response.data["image_data_url"].startswith("data:image/svg+xml;base64,")
    return str(response.data["challenge_id"])


@pytest.fixture
def admin_client() -> APIClient:
    admin = User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="a-secure-admin-password",
    )
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.fixture
def roles_with_pages() -> tuple[Role, Role]:
    menu = NavigationMenu.objects.create(code="user-test", name_zh="用户测试", name_en="User Test")
    pages = [
        NavigationItem.objects.create(
            menu=menu,
            item_type=NavigationItem.ItemType.PAGE,
            key=f"user-test.{index}",
            label_zh=f"页面 {index}",
            label_en=f"Page {index}",
            frontend_path=f"/user-test/{index}",
            position=index,
        )
        for index in range(3)
    ]
    manager = Role.objects.create(code="manager", name="Manager")
    manager.pages.set(pages[:2])
    analyst = Role.objects.create(code="analyst", name="Analyst")
    analyst.pages.set(pages[1:])
    return manager, analyst


@pytest.mark.django_db
def test_user_crud_assigns_multiple_roles_and_returns_permission_union(
    admin_client: APIClient,
    roles_with_pages: tuple[Role, Role],
) -> None:
    manager, analyst = roles_with_pages
    response = admin_client.post(
        reverse("user-list"),
        {
            "username": "joe",
            "email": "joe@example.com",
            "first_name": "Joe",
            "last_name": "Wan",
            "role_ids": [str(manager.id), str(analyst.id)],
            "is_active": True,
        },
        format="json",
    )

    assert response.status_code == 201
    assert set(response.data["role_ids"]) == {str(manager.id), str(analyst.id)}
    assert len(response.data["effective_page_ids"]) == 3
    assert "password" not in response.data
    assert authenticate(email="joe@example.com", password="password123") is not None


@pytest.mark.django_db
def test_superuser_can_assign_user_system_mode(admin_client: APIClient) -> None:
    user = User.objects.create_user(
        username="mode-user",
        email="mode-user@example.com",
        password="password123",
    )

    response = admin_client.put(
        reverse("user-detail", kwargs={"pk": user.id}),
        {
            "username": user.username,
            "email": user.email,
            "first_name": "",
            "last_name": "",
            "is_active": True,
            "is_protected": False,
            "system_mode": "PRODUCTION",
            "role_ids": [],
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["system_mode"] == User.SystemMode.PRODUCTION
    user.refresh_from_db()
    assert user.system_mode == User.SystemMode.PRODUCTION

    user_client = APIClient()
    user_client.force_authenticate(user)
    assert user_client.get(reverse("auth-me")).data["system_mode"] == User.SystemMode.PRODUCTION


@pytest.mark.django_db
def test_role_manager_cannot_change_user_system_mode() -> None:
    page = NavigationItem.objects.get(key="settings.users")
    role = Role.objects.create(code="user-mode-manager", name="User mode manager")
    role.pages.add(page)
    manager = User.objects.create_user(
        username="manager",
        email="manager@example.com",
        password="password123",
    )
    manager.roles.add(role)
    target = User.objects.create_user(
        username="target",
        email="target@example.com",
        password="password123",
    )
    client = APIClient()
    client.force_authenticate(manager)

    response = client.put(
        reverse("user-detail", kwargs={"pk": target.id}),
        {
            "username": target.username,
            "email": target.email,
            "first_name": "",
            "last_name": "",
            "is_active": True,
            "is_protected": False,
            "system_mode": "PRODUCTION",
            "role_ids": [],
        },
        format="json",
    )

    assert response.status_code == 400
    assert "system_mode" in response.data
    target.refresh_from_db()
    assert target.system_mode == User.SystemMode.TEST


@pytest.mark.django_db
def test_anonymous_user_role_cannot_be_assigned_to_system_user(admin_client: APIClient) -> None:
    role = Role.objects.get(code=Role.ANONYMOUS_ROLE_CODE)

    response = admin_client.post(
        reverse("user-list"),
        {
            "username": "public-policy",
            "email": "public-policy@example.com",
            "first_name": "Public",
            "last_name": "Policy",
            "role_ids": [str(role.id)],
            "is_active": True,
        },
        format="json",
    )

    assert response.status_code == 400
    assert not User.objects.filter(email="public-policy@example.com").exists()


@pytest.mark.django_db
def test_password_reset_always_restores_default_password(admin_client: APIClient) -> None:
    user = User.objects.create_user(username="simple", email="simple@example.com", password="old-password")

    response = admin_client.post(
        reverse("user-reset-password", kwargs={"pk": user.id}),
        {"new_password": "this-value-must-be-ignored"},
        format="json",
    )

    assert response.status_code == 204
    user.refresh_from_db()
    assert user.check_password("password123")
    assert not user.check_password("this-value-must-be-ignored")


@pytest.mark.django_db
def test_lock_blocks_authentication_and_reset_password_replaces_secret(admin_client: APIClient) -> None:
    user = User.objects.create_user(username="operator", email="operator@example.com", password="old-secure-password")

    lock_response = admin_client.post(reverse("user-lock", kwargs={"pk": user.id}), {"locked": True}, format="json")
    assert lock_response.status_code == 200
    assert authenticate(email="operator@example.com", password="old-secure-password") is None

    reset_response = admin_client.post(reverse("user-reset-password", kwargs={"pk": user.id}), {}, format="json")
    assert reset_response.status_code == 204
    user.refresh_from_db()
    assert user.check_password("password123")


@pytest.mark.django_db
def test_bulk_delete_is_atomic_when_selection_contains_superuser(admin_client: APIClient) -> None:
    admin = User.objects.get(username="admin")
    user = User.objects.create_user(username="cashier", email="cashier@example.com", password="a-secure-password")

    response = admin_client.post(
        reverse("user-bulk-delete"),
        {"user_ids": [str(admin.id), str(user.id)]},
        format="json",
    )

    assert response.status_code == 400
    assert User.objects.filter(pk=user.pk).exists()


@pytest.mark.django_db
def test_protected_user_cannot_be_deleted_individually_or_in_bulk(admin_client: APIClient) -> None:
    protected = User.objects.create_user(
        username="protected",
        email="protected@example.com",
        password="password123",
        is_protected=True,
    )

    detail_response = admin_client.delete(reverse("user-detail", kwargs={"pk": protected.id}))
    bulk_response = admin_client.post(
        reverse("user-bulk-delete"),
        {"user_ids": [str(protected.id)]},
        format="json",
    )

    assert detail_response.status_code == 400
    assert bulk_response.status_code == 400
    assert User.objects.filter(pk=protected.pk).exists()


@pytest.mark.django_db
def test_deleting_user_removes_owned_preferences_and_role_membership(admin_client: APIClient) -> None:
    user = User.objects.create_user(username="deletable", email="deletable@example.com", password="password123")
    preferences = UserPreference.objects.create(user=user, sidebar_pinned=False)
    role = Role.objects.create(
        code="deletion-test-role",
        name="Deletion test role",
        created_by=user,
        updated_by=user,
    )
    user.roles.add(role)

    response = admin_client.delete(reverse("user-detail", kwargs={"pk": user.id}))

    assert response.status_code == 204
    assert not User.objects.filter(pk=user.pk).exists()
    assert not UserPreference.objects.filter(pk=preferences.pk).exists()
    assert not User.roles.through.objects.filter(user_id=user.pk).exists()
    role.refresh_from_db()
    assert role.created_by is None
    assert role.updated_by is None


@pytest.mark.django_db
def test_bulk_deleting_users_removes_preferences_and_role_memberships(admin_client: APIClient) -> None:
    role = Role.objects.create(code="bulk-deletion-role", name="Bulk deletion role")
    users = [
        User.objects.create_user(
            username=f"bulk-deletable-{index}",
            email=f"bulk-deletable-{index}@example.com",
            password="password123",
        )
        for index in range(2)
    ]
    preference_ids = [UserPreference.objects.create(user=user).pk for user in users]
    for user in users:
        user.roles.add(role)

    response = admin_client.post(
        reverse("user-bulk-delete"),
        {"user_ids": [str(user.id) for user in users]},
        format="json",
    )

    assert response.status_code == 204
    assert not User.objects.filter(pk__in=[user.pk for user in users]).exists()
    assert not UserPreference.objects.filter(pk__in=preference_ids).exists()
    assert not User.roles.through.objects.filter(user_id__in=[user.pk for user in users]).exists()


@pytest.mark.django_db
def test_registration_creates_authenticated_browser_session(admin_client: APIClient) -> None:
    guest_role, _ = Role.objects.get_or_create(
        code="store-guest",
        defaults={"name": "guest", "is_protected": True},
    )
    client = APIClient()
    captcha_id = issue_registration_captcha(client)
    response = client.post(
        reverse("auth-register"),
        {
            "username": "new-user",
            "first_name": "小明",
            "last_name": "王",
            "email": "new@example.com",
            "password": "simple-password",
            "captcha_id": captcha_id,
            "captcha_answer": "1234",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["username"] == "new-user"
    assert response.data["first_name"] == "小明"
    assert response.data["last_name"] == "王"
    assert client.get(reverse("auth-me")).status_code == 200
    assert client.cookies["sessionid"]["expires"] == ""
    user = User.objects.get(username="new-user")
    assert list(user.roles.values_list("code", flat=True)) == [guest_role.code]
    list_response = admin_client.get(reverse("user-list"), {"search": "new-user"})
    assert list_response.status_code == 200
    assert [item["username"] for item in list_response.data] == ["new-user"]


@pytest.mark.django_db
def test_registration_rejects_invalid_and_reused_captcha() -> None:
    Role.objects.get_or_create(code="store-guest", defaults={"name": "guest", "is_protected": True})
    client = APIClient()
    captcha_id = issue_registration_captcha(client)
    payload = {
        "username": "captcha-user",
        "first_name": "Test",
        "last_name": "User",
        "email": "captcha@example.com",
        "password": "simple-password",
        "captcha_id": captcha_id,
        "captcha_answer": "9999",
    }

    invalid_response = client.post(reverse("auth-register"), payload, format="json")
    payload["captcha_answer"] = "1234"
    reused_response = client.post(reverse("auth-register"), payload, format="json")

    assert invalid_response.status_code == 400
    assert reused_response.status_code == 400
    assert not User.objects.filter(username="captcha-user").exists()


@pytest.mark.django_db
def test_current_user_can_update_username_and_separate_name_fields() -> None:
    user = User.objects.create_user(
        username="old-name",
        email="profile@example.com",
        first_name="Old",
        last_name="Name",
        password="secret",
    )
    client = APIClient()
    client.force_login(user)

    response = client.patch(
        reverse("auth-me"),
        {"username": "New-Name", "first_name": "Ming", "last_name": "Wang"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["username"] == "New-Name"
    assert response.data["first_name"] == "Ming"
    assert response.data["last_name"] == "Wang"
    user.refresh_from_db()
    assert user.username == "New-Name"
    assert client.get(reverse("auth-me")).status_code == 200


@pytest.mark.django_db
def test_usernames_can_repeat_and_preserve_letter_case() -> None:
    user = User.objects.create_user(username="profile-user", email="profile@example.com", password="secret")
    User.objects.create_user(username="Joe", email="existing@example.com", password="secret")
    client = APIClient()
    client.force_login(user)

    response = client.patch(reverse("auth-me"), {"username": "Joe"}, format="json")

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.username == "Joe"
    assert User.objects.filter(username="Joe").count() == 2


@pytest.mark.django_db
def test_email_addresses_are_unique_regardless_of_letter_case(admin_client: APIClient) -> None:
    User.objects.create_user(username="FirstJoe", email="joe@example.com", password="secret")

    response = admin_client.post(
        reverse("user-list"),
        {
            "username": "SecondJoe",
            "email": "JOE@EXAMPLE.COM",
            "first_name": "Joe",
            "last_name": "Two",
            "role_ids": [],
            "is_active": True,
        },
        format="json",
    )

    assert response.status_code == 400
    assert User.objects.filter(email__iexact="joe@example.com").count() == 1


@pytest.mark.django_db
def test_remembered_login_sets_seven_day_cookie_and_logout_clears_session() -> None:
    User.objects.create_user(username="remember-me", email="remember@example.com", password="secret")
    client = APIClient()

    login_response = client.post(
        reverse("auth-login"),
        {"email": "REMEMBER@EXAMPLE.COM", "password": "secret", "remember": True},
        format="json",
    )

    assert login_response.status_code == 200
    assert int(client.cookies["sessionid"]["max-age"]) == 60 * 60 * 24 * 7
    assert client.get(reverse("auth-me")).status_code == 200
    assert client.post(reverse("auth-logout")).status_code == 204
    assert client.get(reverse("auth-me")).status_code == 403


@pytest.mark.django_db
def test_same_browser_session_is_available_to_another_page_client() -> None:
    User.objects.create_user(username="shared-session", email="shared@example.com", password="secret")
    first_page = APIClient()
    login_response = first_page.post(
        reverse("auth-login"),
        {"email": "shared@example.com", "password": "secret", "remember": False},
        format="json",
    )
    assert login_response.status_code == 200

    second_page = APIClient()
    second_page.cookies["sessionid"] = first_page.cookies["sessionid"].value
    refreshed_response = second_page.get(reverse("auth-me"))

    assert refreshed_response.status_code == 200
    assert refreshed_response.data["email"] == "shared@example.com"


@pytest.mark.django_db
def test_change_password_keeps_current_session_and_replaces_password() -> None:
    user = User.objects.create_user(username="password-user", email="password@example.com", password="old")
    client = APIClient()
    client.force_login(user)

    response = client.post(
        reverse("auth-change-password"),
        {"current_password": "old", "new_password": "new", "confirm_password": "new"},
        format="json",
    )

    assert response.status_code == 204
    assert client.get(reverse("auth-me")).status_code == 200
    user.refresh_from_db()
    assert user.check_password("new")


@pytest.mark.django_db
def test_login_requires_csrf_token_in_browser_context() -> None:
    User.objects.create_user(username="csrf-user", email="csrf@example.com", password="secret")
    client = APIClient(enforce_csrf_checks=True)
    payload = {"email": "csrf@example.com", "password": "secret", "remember": False}

    assert client.post(reverse("auth-login"), payload, format="json").status_code == 403
    assert client.get(reverse("auth-csrf")).status_code == 200
    token = client.cookies["csrftoken"].value
    assert client.post(reverse("auth-login"), payload, format="json", HTTP_X_CSRFTOKEN=token).status_code == 200


@pytest.mark.django_db
def test_account_preferences_persist_across_login_sessions() -> None:
    user = User.objects.create_user(username="preferences-user", email="preferences@example.com", password="secret")
    first_client = APIClient()
    first_client.force_login(user)

    response = first_client.patch(
        reverse("auth-preferences"),
        {
            "theme": "pink",
            "locale": "en-GB",
            "table_page_size": 20,
            "sidebar_pinned": False,
            "contract_interaction_settings": {"default_view": "review"},
        },
        format="json",
    )

    assert response.status_code == 200
    second_client = APIClient()
    second_client.force_login(user)
    session_response = second_client.get(reverse("auth-me"))
    preferences = session_response.data["preferences"]
    assert preferences["theme"] == "pink"
    assert preferences["locale"] == "en-GB"
    assert preferences["table_page_size"] == 20
    assert preferences["sidebar_pinned"] is False
    assert preferences["contract_interaction_settings"] == {"default_view": "review"}


@pytest.mark.django_db
def test_account_preferences_reject_invalid_enumerated_values() -> None:
    user = User.objects.create_user(username="invalid-preferences", email="invalid@example.com", password="secret")
    client = APIClient()
    client.force_login(user)

    response = client.patch(
        reverse("auth-preferences"),
        {"theme": "unknown", "locale": "xx-YY", "week_starts_on": 7},
        format="json",
    )

    assert response.status_code == 400
