FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements ./requirements
RUN pip install --no-cache-dir -r requirements/base.txt

FROM base AS development
RUN pip install --no-cache-dir -r requirements/development.txt
COPY . .

FROM base AS production
COPY . .
RUN DJANGO_SECRET_KEY=build-only-secret-key \
    DATABASE_URL=sqlite:///:memory: \
    DJANGO_ALLOWED_HOSTS=localhost \
    DJANGO_CORS_ALLOWED_ORIGINS=http://localhost \
    DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost \
    DJANGO_SECURE_SSL_REDIRECT=false \
    python manage.py collectstatic --noinput --settings=config.settings.production
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
