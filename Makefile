.PHONY: up down build logs migrate shell dbshell neo4j-indexes seed test lint

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-celery:
	docker compose logs -f celery-ingestion celery-embedding celery-llm celery-graph

logs-frontend:
	docker compose logs -f frontend

migrate:
	docker compose exec backend python manage.py migrate

makemigrations:
	docker compose exec backend python manage.py makemigrations

shell:
	docker compose exec backend python manage.py shell

dbshell:
	docker compose exec postgres psql -U graphite -d graphite

neo4j-indexes:
	docker compose exec backend python scripts/create_neo4j_indexes.py

seed:
	docker compose exec backend python scripts/seed_data.py

test:
	docker compose exec backend pytest -x -v

test-cov:
	docker compose exec backend pytest --cov=apps --cov-report=term-missing

lint:
	docker compose exec backend ruff check .
	docker compose exec backend ruff format --check .

format:
	docker compose exec backend ruff format .

createsuperuser:
	docker compose exec backend python manage.py createsuperuser

restart-backend:
	docker compose restart backend celery-ingestion celery-embedding celery-llm celery-graph

ps:
	docker compose ps
