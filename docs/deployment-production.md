# BakeOps Production Deployment

BakeOps keeps development and production configuration separate.

- Development: `compose.yaml` + `.env`
- Production: `compose.prod.yaml` + `.env.prod`

The production secret file `.env.prod` is intentionally ignored by Git. Start from the tracked template:

```bash
cp .env.prod.example .env.prod
```

Before deploying, replace every placeholder in `.env.prod`, especially:

- `POSTGRES_PASSWORD`
- `DJANGO_SECRET_KEY`
- `DEFAULT_USER_PASSWORD`
- `BAKEOPS_DOMAIN`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`

Production build and startup:

```bash
make prod-up
make prod-migrate
make prod-ps
```

Useful production commands:

```bash
make prod-build
make prod-logs
make prod-down
```

Production security differences from development:

- Django uses `config.settings.production`.
- `DJANGO_DEBUG` must be `false`.
- Backend runs with Gunicorn, not Django `runserver`.
- Frontend runs the Next.js standalone server, not `npm run dev`.
- Source directories are not mounted into containers.
- PostgreSQL is not published to the public host network.
- Caddy publishes only ports `80` and `443` and handles HTTPS for `BAKEOPS_DOMAIN`.

After DNS points `BAKEOPS_DOMAIN` to the server public IP, Caddy will request and renew HTTPS certificates automatically.
