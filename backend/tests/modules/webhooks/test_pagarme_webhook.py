"""Webhook /api/webhooks/pagarme — assinatura HMAC, idempotência, transição de status."""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.core.extensions import db as _db
from app.models import CreditTransaction, Order, PaymentEvent


pytestmark = pytest.mark.checkout


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_signature(raw_body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


@pytest.fixture
def pending_order(db, client_user):
    order = Order(
        user_id=client_user.id,
        company_id=client_user.company_id,
        service_id="plano_essencial",
        amount=48_000,
        status="processing",
        idempotency_key=f"wb-{uuid4().hex[:8]}",
        pagarme_order_id="or_test_webhook_1",
        pagarme_charge_id="ch_test_webhook_1",
    )
    db.session.add(order)
    db.session.commit()
    return order


# ---------------------------------------------------------------------------
# Sucesso
# ---------------------------------------------------------------------------


class TestPagarmeWebhookHappyPath:
    def test_order_paid_event_marks_order_paid_and_releases_credit(
        self, client, pending_order, db, app
    ):
        payload = {
            "id": "evt_webhook_paid_1",
            "type": "order.paid",
            "data": {
                "id": pending_order.pagarme_order_id,
                "status": "paid",
                "metadata": {"local_order_id": str(pending_order.id)},
            },
        }
        raw = json.dumps(payload).encode("utf-8")
        signature = _make_signature(raw, app.config["PAGARME_WEBHOOK_TOKEN"])

        response = client.post(
            "/api/webhooks/pagarme",
            data=raw,
            content_type="application/json",
            headers={"X-Hub-Signature-256": signature},
        )
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        assert body["ok"] is True
        assert body["status"] == "paid"

        _db.session.refresh(pending_order)
        assert pending_order.status == "paid"

        # CreditTransaction foi criada (regressão B-5)
        tx = CreditTransaction.query.filter_by(
            user_id=pending_order.user_id, source="checkout"
        ).first()
        assert tx is not None, "Webhook 'paid' deve liberar crédito ao cliente"

    def test_charge_failed_event_marks_order_failed(self, client, pending_order, db, app):
        payload = {
            "id": "evt_webhook_failed_1",
            "type": "charge.failed",
            "data": {"id": pending_order.pagarme_charge_id, "status": "failed"},
        }
        raw = json.dumps(payload).encode("utf-8")
        signature = _make_signature(raw, app.config["PAGARME_WEBHOOK_TOKEN"])

        response = client.post(
            "/api/webhooks/pagarme",
            data=raw,
            content_type="application/json",
            headers={"X-Hub-Signature-256": signature},
        )
        assert response.status_code == 200
        _db.session.refresh(pending_order)
        assert pending_order.status == "failed"


# ---------------------------------------------------------------------------
# Idempotência
# ---------------------------------------------------------------------------


class TestPagarmeWebhookIdempotency:
    def test_duplicate_event_id_is_ignored(self, client, pending_order, db, app):
        payload = {
            "id": "evt_duplicate_xyz",
            "type": "order.paid",
            "data": {
                "id": pending_order.pagarme_order_id,
                "status": "paid",
                "metadata": {"local_order_id": str(pending_order.id)},
            },
        }
        raw = json.dumps(payload).encode("utf-8")
        signature = _make_signature(raw, app.config["PAGARME_WEBHOOK_TOKEN"])

        first = client.post(
            "/api/webhooks/pagarme", data=raw, content_type="application/json",
            headers={"X-Hub-Signature-256": signature},
        )
        second = client.post(
            "/api/webhooks/pagarme", data=raw, content_type="application/json",
            headers={"X-Hub-Signature-256": signature},
        )
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.get_json().get("duplicate") is True

        # CreditTransaction única (não duplicada)
        count = CreditTransaction.query.filter_by(
            user_id=pending_order.user_id, source="checkout"
        ).count()
        assert count == 1

        # Apenas um PaymentEvent persistido por gateway_event_id
        evt_count = PaymentEvent.query.filter_by(
            gateway="pagarme", gateway_event_id="evt_duplicate_xyz"
        ).count()
        assert evt_count == 1


# ---------------------------------------------------------------------------
# Segurança — assinatura HMAC
# ---------------------------------------------------------------------------


class TestPagarmeWebhookSignature:
    def test_invalid_signature_is_rejected(self, client, pending_order, db):
        payload = {"id": "evt_bad_sig", "type": "order.paid", "data": {}}
        raw = json.dumps(payload).encode("utf-8")

        response = client.post(
            "/api/webhooks/pagarme",
            data=raw,
            content_type="application/json",
            headers={"X-Hub-Signature-256": "sha256=deadbeef"},
        )
        # Assinatura inválida → 401 (AuthError)
        assert response.status_code == 401

        _db.session.refresh(pending_order)
        # Pedido NÃO foi atualizado
        assert pending_order.status == "processing"

    def test_request_without_signature_is_rejected_in_production_mode(
        self, client, pending_order, db
    ):
        """O fixture roda com DEBUG=False (modo produção). A rota exige
        assinatura HMAC obrigatoriamente e retorna 400 quando falta."""
        payload = {"id": "evt_no_sig", "type": "order.paid"}
        response = client.post(
            "/api/webhooks/pagarme",
            data=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
        )
        # 400 = ValidationError "Assinatura do webhook obrigatória em produção"
        assert response.status_code == 400
        # Pedido não foi atualizado
        _db.session.refresh(pending_order)
        assert pending_order.status == "processing"

    def test_valid_token_fallback_in_dev_mode(self, app, pending_order, db):
        """Em modo dev (DEBUG=True), o webhook aceita token bruto como fallback.
        Aqui criamos um app dev override para validar esse caminho."""
        # Reconfigura o app para modo dev
        app.config["DEBUG"] = True
        try:
            payload = {
                "id": "evt_token_fallback_dev",
                "type": "order.paid",
                "data": {
                    "id": pending_order.pagarme_order_id,
                    "status": "paid",
                    "metadata": {"local_order_id": str(pending_order.id)},
                },
            }
            response = app.test_client().post(
                "/api/webhooks/pagarme",
                data=json.dumps(payload).encode("utf-8"),
                content_type="application/json",
                headers={"X-Pagarme-Webhook-Token": app.config["PAGARME_WEBHOOK_TOKEN"]},
            )
            assert response.status_code == 200, response.get_json()
        finally:
            app.config["DEBUG"] = False
