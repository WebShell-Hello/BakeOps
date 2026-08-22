GLOBAL_SUPERUSER_EMAIL = "joe.jiaqiao.wan@gmail.com"


def is_global_superuser(user: object) -> bool:
    return bool(
        getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
        and getattr(user, "is_superuser", False)
        and str(getattr(user, "email", "")).strip().lower() == GLOBAL_SUPERUSER_EMAIL
    )
