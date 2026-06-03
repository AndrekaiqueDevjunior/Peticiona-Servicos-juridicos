SHELL := /bin/bash

.PHONY: deploy deploy-backend deploy-frontend db-up db-down backend-dev frontend-dev lint-frontend build-frontend

# ── Deploy (VPS) ──────────────────────────────────────────────────────────────
# Sempre usa --build. NUNCA usar "docker compose restart" para deploy.

deploy:
	@bash scripts/deploy.sh all

deploy-backend:
	@bash scripts/deploy.sh backend

deploy-frontend:
	@bash scripts/deploy.sh frontend

# ── Desenvolvimento local ─────────────────────────────────────────────────────

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
