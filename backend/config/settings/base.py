from pathlib import Path

import environ
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parents[2]
env = environ.Env()

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS: list[str] = []
CORS_ALLOW_HEADERS = (*default_headers, "x-bakeops-system-mode")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "django_filters",
    "rest_framework",
    "drf_spectacular",
    "bakeops.common.apps.CommonConfig",
    "bakeops.access.apps.AccessConfig",
    "bakeops.audit.apps.AuditConfig",
    "bakeops.navigation.apps.NavigationConfig",
    "bakeops.employees.apps.EmployeesConfig",
    "bakeops.costs.apps.CostsConfig",
    "bakeops.events.apps.EventsConfig",
    "bakeops.products.apps.ProductsConfig",
    "bakeops.inventory.apps.InventoryConfig",
    "bakeops.scheduling.apps.SchedulingConfig",
    "bakeops.sales.apps.SalesConfig",
    "bakeops.suppliers.apps.SuppliersConfig",
    "bakeops.users.apps.UsersConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "bakeops.audit.middleware.AuditLoggingMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS: list[dict[str, str]] = []
DEFAULT_USER_PASSWORD = env("DEFAULT_USER_PASSWORD", default="password123")
REGISTRATION_CAPTCHA_TTL_SECONDS = env.int("REGISTRATION_CAPTCHA_TTL_SECONDS", default=300)
AUDIT_ACCESS_DEDUP_SECONDS = env.int("AUDIT_ACCESS_DEDUP_SECONDS", default=60)
AUDIT_SECURITY_DEDUP_SECONDS = env.int("AUDIT_SECURITY_DEDUP_SECONDS", default=60)
AUDIT_BOT_DEDUP_SECONDS = env.int("AUDIT_BOT_DEDUP_SECONDS", default=600)
AUDIT_ACCESS_RETENTION_DAYS = env.int("AUDIT_ACCESS_RETENTION_DAYS", default=90)
AUDIT_EVENT_RETENTION_DAYS = env.int("AUDIT_EVENT_RETENTION_DAYS", default=365)
DATA_SOURCE_CONFIG_FILE = env("DATA_SOURCE_CONFIG_FILE", default=str(BASE_DIR / "runtime" / "data-source.json"))
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Europe/London"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "BakeOps API",
    "DESCRIPTION": "Bakery operations platform API",
    "VERSION": "1.0.0",
}
