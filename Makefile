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

smoke-vps:
	@SMOKE_EMAIL=$${SMOKE_EMAIL:-clarissanjosino@gmail.com} \
	 SMOKE_PASSWORD=$${SMOKE_PASSWORD} \
	 python3 scripts/smoke_vps.py --url https://peticiona.app.br

smoke-local:
	@SMOKE_EMAIL=$${SMOKE_EMAIL:-clarissanjosino@gmail.com} \
	 SMOKE_PASSWORD=$${SMOKE_PASSWORD} \
	 python3 scripts/smoke_vps.py --url http://localhost:5000

lint-frontend:
	cd frontend && npm run lint

build-frontend:
	cd frontend && npm run build
