SHELL := /bin/bash

.PHONY: db-up db-down backend-dev frontend-dev lint-frontend build-frontend

db-up:
	docker compose up -d db

db-down:
	docker compose down

backend-dev:
	python3 backend/run.py

frontend-dev:
	cd frontend && npm run dev

lint-frontend:
	cd frontend && npm run lint

build-frontend:
	cd frontend && npm run build
