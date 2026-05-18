"""Webhook /api/webhooks/resend — assinatura svix + persistência de EmailEvent."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os

import pytest

from app.core.extensions import db as _db
from app.models.email_event import EmailEvent


pytestmark = pytest.mark.integration


# Segredo de teste arbitrário (base64-encoded para casar com formato Resend "whsec_...")
_SECRET_BYTES = b"this-is-a-test-svix-secret-bytes!"
TEST_SECRET = "whsec_" + base64.b64encode(_SECRET_BYTES).decode("ascii")


def _svix_signature(msg_id: str, timestamp: str, raw_body: bytes) -> str:
    signed = f"{msg_id}.{timestamp}.".encode("utf-8") + raw_body
    digest = hmac.new(_SECRET_BYTES, signed, hashlib.sha256).digest()
    return "v1," + base64.b64encode(digest).decode("ascii")


# ---------------------------------------------------------------------------
# Sem secret configurado: webhook aceita sem validar (fallback de dev)
# ---------------------------------------------------------------------------


class TestResendWithoutSecret:
    def test_without_secret_accepts_payload(self, client, db):
        payload = {
            "type": "email.delivered",
            "data": {"email_id": "e_open_1", "to": "client@example.com", "subject": "Hi"},
        }
        response = client.post(
            "/api/webhooks/resend",
            data=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
            headers={"svix-id": "msg_open_1"},
        )
        assert response.status_code == 200
        assert response.get_json()["ok"] is True

        # Evento registrado em EmailEvent
        event = EmailEvent.query.filter_by(event_id="msg_open_1").first()
        assert event is not None
        assert event.event_type == "email.delivered"
        assert event.recipient == "client@example.com"


# ---------------------------------------------------------------------------
# Com secret configurado: assinatura é obrigatória
# ---------------------------------------------------------------------------


@pytest.fixture
def app_with_secret(app):
    app.config["RESEND_WEBHOOK_SECRET"] = TEST_SECRET
    yield app
    app.config["RESEND_WEBHOOK_SECRET"] = ""


class TestResendWithSecret:
    def test_valid_signature_accepts_payload(self, app_with_secret, db):
        payload = {
            "type": "email.bounced",
            "data": {"email_id": "e_bounce_1", "to": "user@example.com"},
        }
        raw = json.dumps(payload).encode("utf-8")
        msg_id, timestamp = "msg_b1", "1700000000"
        signature = _svix_signature(msg_id, timestamp, raw)

        response = app_with_secret.test_client().post(
            "/api/webhooks/resend",
            data=raw,
            content_type="application/json",
            headers={
                "svix-id": msg_id,
                "svix-timestamp": timestamp,
                "svix-signature": signature,
            },
        )
        assert response.status_code == 200

        # EmailEvent salvo
        event = EmailEvent.query.filter_by(event_id=msg_id).first()
        assert event is not None
        assert event.event_type == "email.bounced"

    def test_invalid_signature_is_rejected(self, app_with_secret):
        payload = {"type": "email.delivered", "data": {}}
        response = app_with_secret.test_client().post(
            "/api/webhooks/resend",
            data=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
            headers={
                "svix-id": "msg_x",
                "svix-timestamp": "1700000000",
                "svix-signature": "v1,deadbeef",
            },
        )
        assert response.status_code == 400
        body = response.get_json()
        assert body["error"] == "VALIDATION_ERROR"

    def test_missing_signature_headers_is_rejected(self, app_with_secret):
        response = app_with_secret.test_client().post(
            "/api/webhooks/resend",
            data=json.dumps({"type": "email.x"}).encode("utf-8"),
            content_type="application/json",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Idempotência por event_id (svix-id)
# ---------------------------------------------------------------------------


class TestResendIdempotency:
    def test_duplicate_event_id_returns_duplicate_flag(self, client, db):
        payload = {"type": "email.opened", "data": {"email_id": "dup_1"}}
        headers = {"svix-id": "msg_dup_1"}

        first = client.post(
            "/api/webhooks/resend",
            data=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
            headers=headers,
        )
        second = client.post(
            "/api/webhooks/resend",
            data=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
            headers=headers,
        )
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.get_json().get("duplicate") is True

        # Apenas uma linha persistida
        count = EmailEvent.query.filter_by(event_id="msg_dup_1").count()
        assert count == 1


# ---------------------------------------------------------------------------
# Notificação interna: POST /api/notify-email
# ---------------------------------------------------------------------------


class TestNotifyEmail:
    VALID = {
        "event": "pedido_criado",
        "subject": "Pedido recém-criado",
        "body": "Detalhes do pedido X.",
    }

    def test_admin_dispatches_notification(self, api_admin, monkeypatch, app):
        import app.modules.notifications.routes as notif_routes
        from tests.utils.mocks import capture_emails

        app.config["NOTIFICATION_EMAIL"] = "admin@peticiona.app.br"
        emails = capture_emails(monkeypatch, target_module=notif_routes)

        response = api_admin.post("/api/notify-email", json=self.VALID)
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        assert body["delivered"] is True
        assert emails, "Email deve ser enviado"
        assert emails[0]["to"] == "admin@peticiona.app.br"
        assert emails[0]["subject"].startswith("Pedido")

    def test_invalid_event_is_400(self, api_admin, monkeypatch):
        import app.modules.notifications.routes as notif_routes
        from tests.utils.mocks import capture_emails

        capture_emails(monkeypatch, target_module=notif_routes)
        response = api_admin.post(
            "/api/notify-email",
            json={"event": "evento_qualquer", "subject": "x", "body": "y"},
        )
        assert response.status_code == 400
        assert response.get_json()["error"] == "INVALID_EVENT"

    def test_missing_subject_is_400(self, api_admin, monkeypatch):
        import app.modules.notifications.routes as notif_routes
        from tests.utils.mocks import capture_emails

        capture_emails(monkeypatch, target_module=notif_routes)
        response = api_admin.post(
            "/api/notify-email",
            json={"event": "pedido_criado", "subject": "", "body": "x"},
        )
        assert response.status_code == 400

    def test_without_notification_email_returns_202(self, api_admin, app, monkeypatch):
        import app.modules.notifications.routes as notif_routes
        from tests.utils.mocks import capture_emails

        app.config["NOTIFICATION_EMAIL"] = ""
        capture_emails(monkeypatch, target_module=notif_routes)

        response = api_admin.post("/api/notify-email", json=self.VALID)
        # Comportamento intencional: 202 Accepted com delivered=False
        assert response.status_code == 202
        assert response.get_json()["delivered"] is False

    def test_staff_can_notify(self, api_staff, monkeypatch, app):
        import app.modules.notifications.routes as notif_routes
        from tests.utils.mocks import capture_emails

        app.config["NOTIFICATION_EMAIL"] = "admin@peticiona.app.br"
        capture_emails(monkeypatch, target_module=notif_routes)

        response = api_staff.post("/api/notify-email", json=self.VALID)
        # Rota só exige auth, não restringe role
        assert response.status_code == 200

    def test_anonymous_blocked(self, api_anonymous):
        response = api_anonymous.post("/api/notify-email", json=self.VALID)
        assert response.status_code == 401
