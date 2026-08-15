.PHONY: build up down logs ps migrate makemigrations test check shell prod-build prod-up prod-down prod-logs prod-ps prod-migrate

build:
	docker compose build

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

migrate:
	docker compose exec backend python manage.py migrate

makemigrations:
	docker compose exec backend python manage.py makemigrations

test:
	docker compose exec -e DJANGO_SETTINGS_MODULE=config.settings.test backend pytest

check:
	docker compose exec backend python manage.py check
	docker compose exec backend ruff check .
	docker compose exec -e DJANGO_SETTINGS_MODULE=config.settings.test backend mypy --no-incremental .
	docker compose exec frontend npm run lint
	docker compose exec frontend npm run typecheck

shell:
	docker compose exec backend python manage.py shell

prod-build:
	docker compose --env-file .env.prod -f compose.prod.yaml build

prod-up:
	docker compose --env-file .env.prod -f compose.prod.yaml up --build -d

prod-down:
	docker compose --env-file .env.prod -f compose.prod.yaml down

prod-logs:
	docker compose --env-file .env.prod -f compose.prod.yaml logs -f

prod-ps:
	docker compose --env-file .env.prod -f compose.prod.yaml ps

prod-migrate:
	docker compose --env-file .env.prod -f compose.prod.yaml exec backend python manage.py migrate
