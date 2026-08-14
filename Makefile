.PHONY: build up down logs ps migrate makemigrations test check shell

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
