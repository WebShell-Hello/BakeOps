import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from .base import *  # noqa: E402,F403
from .base import MIDDLEWARE as BASE_MIDDLEWARE  # noqa: E402

MIDDLEWARE = [
    middleware for middleware in BASE_MIDDLEWARE if middleware != "whitenoise.middleware.WhiteNoiseMiddleware"
]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
