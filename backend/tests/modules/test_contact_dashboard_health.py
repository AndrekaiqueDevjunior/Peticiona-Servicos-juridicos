"""Cobertura de rotas simples: /api/contact, /api/dashboard, /api/health."""

from __future__ import annotations

import pytest

import app.services.contact_service as contact_service
from tests.utils.mocks import capture_emails


pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------


class TestHealth:
    def test_returns_ok(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.get_json() == {"status": "ok"}

    def test_is_public(self, client):
        # Sem auth_required
        assert client.get("/api/health").status_code == 200


# ---------------------------------------------------------------------------
# GET /api/dashboard
# ---------------------------------------------------------------------------


class TestDashboard:
    def test_client_dashboard_lists_own_services(self, api_client, client_user, db):
        from tests.factories import create_service_order

        create_service_order(user=client_user, status="pendente")
        db.session.commit()

        response = api_client.get("/api/dashboard")
        assert response.status_code == 200
        body = response.get_json()
        assert "services" in body or "stats" in body

    def test_filters_by_status(self, api_client, client_user, db):
        from tests.factories import create_service_order

        create_service_order(user=client_user, status="pendente")
        create_service_order(user=client_user, status="concluido")
        db.session.commit()

        response = api_client.get("/api/dashboard?status=pendente")
        assert response.status_code == 200

    def test_anonymous_is_401(self, api_anonymous):
        assert api_anonymous.get("/api/dashboard").status_code == 401


# ---------------------------------------------------------------------------
# POST /api/contact (formulário público com envio de e-mail)
# ---------------------------------------------------------------------------


class TestContactForm:
    VALID = {
        "name": "Maria Cliente",
        "whatsapp": "(11) 98888-7777",
        "email": "maria@example.com",
        "message": "Gostaria de saber mais sobre os planos disponíveis.",
    }

    def test_valid_contact_sends_admin_email(self, client, app, monkeypatch):
        # admin email + provider configurado (sem isso o service entra no
        # DRY-RUN que pula o send_email — comportamento intencional pra
        # dev sem credencial; aqui forçamos o caminho real).
        app.config["NOTIFICATION_EMAIL"] = "admin@peticiona.app.br"
        monkeypatch.setitem(app.config, "SMTP_HOST", "smtp-dummy-for-tests")
        emails = capture_emails(monkeypatch, target_module=contact_service)

        response = client.post("/api/contact", json=self.VALID)
        assert response.status_code == 200, response.get_json()
        assert emails, "Email para admin deve ser enviado"
        first = emails[0]
        assert first["to"] == "admin@peticiona.app.br"
        assert "Maria Cliente" in first["body"]

    def test_invalid_email_format_400(self, client):
        response = client.post(
            "/api/contact", json={**self.VALID, "email": "not-an-email"}
        )
        assert response.status_code == 400

    def test_short_name_400(self, client):
        response = client.post("/api/contact", json={**self.VALID, "name": "A"})
        assert response.status_code == 400

    def test_short_message_400(self, client):
        response = client.post("/api/contact", json={**self.VALID, "message": "oi"})
        assert response.status_code == 400

    def test_invalid_phone_400(self, client):
        response = client.post(
            "/api/contact", json={**self.VALID, "whatsapp": "abc"}
        )
        assert response.status_code == 400

    def test_no_admin_email_returns_503(self, client, app, monkeypatch):
        """Quando o backend não tem destinatário configurado, deve responder 503
        em vez de fingir sucesso."""
        app.config["NOTIFICATION_EMAIL"] = ""
        app.config["RESEND_CONTACT_TO_EMAIL"] = ""
        capture_emails(monkeypatch, target_module=contact_service)

        response = client.post("/api/contact", json=self.VALID)
        assert response.status_code == 503

    def test_email_delivery_failure_returns_503(self, client, app, monkeypatch):
        """Provider configurado mas send_email retorna False (rate limit,
        DNS, etc.) — a rota deve sinalizar 503 pra UI pedir retry."""
        app.config["NOTIFICATION_EMAIL"] = "admin@peticiona.app.br"
        monkeypatch.setitem(app.config, "SMTP_HOST", "smtp-dummy-for-tests")

        def _fail_send(**kwargs):
            return False

        monkeypatch.setattr(contact_service, "send_email", _fail_send)

        response = client.post("/api/contact", json=self.VALID)
        assert response.status_code == 503

    def test_dry_run_without_provider_returns_200(self, client, app, monkeypatch, caplog):
        """Sem provider configurado (RESEND/SENDGRID/SMTP), entra em modo
        DRY-RUN: devolve sucesso pra UI e loga o conteúdo do formulário
        no console. Antes, qualquer ambiente dev sem credencial devolvia
        503 e quebrava a tela de contato."""
        app.config["NOTIFICATION_EMAIL"] = "admin@peticiona.app.br"
        for key in ("RESEND_API_KEY", "SENDGRID_API_KEY", "SMTP_HOST"):
            monkeypatch.setitem(app.config, key, "")
        emails = capture_emails(monkeypatch, target_module=contact_service)

        with caplog.at_level("WARNING"):
            response = client.post("/api/contact", json=self.VALID)

        assert response.status_code == 200
        # Nenhum send_email foi chamado (entra no dry-run antes)
        assert emails == []
        log_text = "\n".join(r.getMessage() for r in caplog.records)
        assert "CONTACT DRY-RUN" in log_text
        assert "Maria Cliente" in log_text
