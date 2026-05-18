"""Cobertura de /api/home, /api/plans, /api/catalog, /api/contact-info,
/api/contact-requests (rotas públicas do módulo content)."""

from __future__ import annotations

import pytest

import app.modules.content.routes as content_routes
from tests.utils.mocks import capture_emails


pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# GET /api/home
# ---------------------------------------------------------------------------


class TestHome:
    def test_returns_hero_and_highlights(self, client):
        response = client.get("/api/home")
        assert response.status_code == 200
        body = response.get_json()
        assert "hero" in body
        assert "highlights" in body
        assert isinstance(body["highlights"], list)

    def test_is_public(self, client):
        # Não tem auth_required
        assert client.get("/api/home").status_code == 200


# ---------------------------------------------------------------------------
# GET /api/plans
# ---------------------------------------------------------------------------


class TestPlans:
    def test_lists_only_active_plans(self, client, db):
        from tests.factories import create_plan

        create_plan(code="plano_inativo", is_active=False, monthly_price_cents=1000)
        create_plan(code="plano_publico", is_active=True, monthly_price_cents=99_000)
        db.session.commit()

        response = client.get("/api/plans")
        assert response.status_code == 200
        codes = {p["code"] for p in response.get_json()["plans"]}
        assert "plano_publico" in codes
        assert "plano_inativo" not in codes
        # Seed canonical também aparece
        assert "plano_essencial" in codes

    def test_is_public(self, client):
        assert client.get("/api/plans").status_code == 200


# ---------------------------------------------------------------------------
# GET /api/catalog  +  GET /api/catalog/<code>
# ---------------------------------------------------------------------------


class TestCatalog:
    def test_full_catalog_returns_plans_services_and_legacy_sections(self, client):
        response = client.get("/api/catalog")
        assert response.status_code == 200
        body = response.get_json()
        # Novo formato
        assert "plans" in body and "services" in body
        # Compatibilidade legada (clientes antigos esperam 'catalog')
        assert "catalog" in body
        assert isinstance(body["catalog"], list)

    def test_catalog_item_finds_plan(self, client):
        response = client.get("/api/catalog/plano_essencial")
        assert response.status_code == 200
        body = response.get_json()
        assert body["type"] == "plan"
        assert body["item"]["code"] == "plano_essencial"

    def test_catalog_item_finds_service(self, client):
        response = client.get("/api/catalog/servico_peticao")
        assert response.status_code == 200
        body = response.get_json()
        assert body["type"] == "service"

    def test_catalog_item_lowercases_code(self, client):
        response = client.get("/api/catalog/PLANO_ESSENCIAL")
        assert response.status_code == 200
        assert response.get_json()["item"]["code"] == "plano_essencial"

    def test_unknown_code_is_404(self, client):
        assert client.get("/api/catalog/fantasma").status_code == 404


# ---------------------------------------------------------------------------
# GET /api/contact-info
# ---------------------------------------------------------------------------


class TestPublicContactInfo:
    def test_returns_contact_info_publicly(self, client):
        response = client.get("/api/contact-info")
        assert response.status_code == 200
        body = response.get_json()
        assert "email" in body
        assert "whatsappDisplay" in body
        assert "whatsapp_raw" in body


# ---------------------------------------------------------------------------
# POST /api/contact-requests
# ---------------------------------------------------------------------------


class TestContactRequest:
    def test_valid_request_sends_email_and_returns_message(self, client, monkeypatch):
        emails = capture_emails(monkeypatch, target_module=content_routes)
        response = client.post(
            "/api/contact-requests",
            json={
                "name": "João Silva",
                "email": "joao@example.com",
                "whatsapp": "(11) 99999-8888",
                "message": "Quero saber mais sobre os planos.",
            },
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["message"]
        assert emails, "Email deve ser despachado"
        assert "joão silva" in emails[0]["body"].lower() or "joao silva" in emails[0]["body"].lower()
        assert "joao@example.com" in emails[0]["body"]

    def test_missing_required_fields_400(self, client, monkeypatch):
        emails = capture_emails(monkeypatch, target_module=content_routes)
        response = client.post(
            "/api/contact-requests",
            json={"name": "", "email": "", "message": ""},
        )
        assert response.status_code == 400
        assert emails == []

    def test_missing_message_400(self, client, monkeypatch):
        capture_emails(monkeypatch, target_module=content_routes)
        response = client.post(
            "/api/contact-requests",
            json={"name": "X", "email": "x@y.com", "message": ""},
        )
        assert response.status_code == 400
