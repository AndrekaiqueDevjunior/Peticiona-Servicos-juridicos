"""Cobertura de /api/payments (credit-packages, credit-orders, smoke, smoke-charge)."""

from __future__ import annotations

import pytest

from app.models import CreditPurchase, CreditTransaction


pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# GET /api/payments/credit-packages
# ---------------------------------------------------------------------------


class TestCreditPackages:
    def test_lists_packages(self, api_client):
        response = api_client.get("/api/payments/credit-packages")
        assert response.status_code == 200
        body = response.get_json()
        assert "packages" in body
        ids = {p["id"] for p in body["packages"]}
        assert {"essencial", "profissional", "estrategico"}.issubset(ids)

    def test_anonymous_blocked(self, api_anonymous):
        assert api_anonymous.get("/api/payments/credit-packages").status_code == 401


# ---------------------------------------------------------------------------
# POST /api/payments/credit-orders  (com fake_pagarme)
# ---------------------------------------------------------------------------


VALID_PURCHASE = {
    "package_id": "essencial",
    "idempotency_key": "test-idemp-123456789012",
    "card_token": "card_token_test_1234",
    "customer": {
        "document": "11122233344",  # CPF 11 dígitos
        "phone": "11988887777",
    },
    "billing_address": {
        "street": "Rua Teste",
        "number": "100",
        "neighborhood": "Centro",
        "city": "São Paulo",
        "state": "SP",
        "zip_code": "01310100",
    },
}


class TestCreditOrders:
    def test_creates_credit_purchase_and_credits_on_paid(
        self, api_client, client_user, fake_pagarme, db
    ):
        response = api_client.post("/api/payments/credit-orders", json=VALID_PURCHASE)
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        purchase = body["purchase"]
        assert purchase["status"] == "paid"
        assert purchase["paid"] is True
        assert purchase["credited"] is True

        # CreditPurchase persistida
        cp = CreditPurchase.query.filter_by(idempotency_key=VALID_PURCHASE["idempotency_key"]).first()
        assert cp is not None

        # CreditTransaction de entrada gerada
        tx = CreditTransaction.query.filter_by(
            user_id=client_user.id, source="plano"
        ).first()
        assert tx is not None
        assert tx.amount == 48_000  # essencial = 48000

    def test_idempotency_returns_existing(self, api_client, fake_pagarme):
        first = api_client.post("/api/payments/credit-orders", json=VALID_PURCHASE)
        second = api_client.post("/api/payments/credit-orders", json=VALID_PURCHASE)
        assert second.status_code in (200, 201)
        assert first.get_json()["purchase"]["id"] == second.get_json()["purchase"]["id"]
        # Pagar.me deve ter sido chamado apenas uma vez
        create_calls = [c for c in fake_pagarme.calls if c["action"] == "create_order"]
        assert len(create_calls) == 1

    def test_unknown_package_is_404(self, api_client, fake_pagarme):
        payload = {**VALID_PURCHASE, "package_id": "nao_existe"}
        response = api_client.post("/api/payments/credit-orders", json=payload)
        assert response.status_code == 404

    def test_invalid_idempotency_key_is_400(self, api_client, fake_pagarme):
        payload = {**VALID_PURCHASE, "idempotency_key": "short"}
        response = api_client.post("/api/payments/credit-orders", json=payload)
        assert response.status_code == 400

    def test_invalid_cpf_is_400(self, api_client, fake_pagarme):
        payload = {
            **VALID_PURCHASE,
            "customer": {"document": "123", "phone": "11988887777"},
        }
        response = api_client.post("/api/payments/credit-orders", json=payload)
        assert response.status_code == 400

    def test_invalid_zip_code_is_400(self, api_client, fake_pagarme):
        payload = {
            **VALID_PURCHASE,
            "billing_address": {**VALID_PURCHASE["billing_address"], "zip_code": "111"},
        }
        response = api_client.post("/api/payments/credit-orders", json=payload)
        assert response.status_code == 400

    def test_invalid_state_is_400(self, api_client, fake_pagarme):
        # UF deve ter 2 letras [A-Z]{2}; "12" não casa
        payload = {
            **VALID_PURCHASE,
            "billing_address": {**VALID_PURCHASE["billing_address"], "state": "12"},
        }
        response = api_client.post("/api/payments/credit-orders", json=payload)
        assert response.status_code == 400

    def test_invalid_card_token_is_400(self, api_client, fake_pagarme):
        payload = {**VALID_PURCHASE, "card_token": "x"}  # < 8 chars
        response = api_client.post("/api/payments/credit-orders", json=payload)
        assert response.status_code == 400

    def test_anonymous_blocked(self, api_anonymous):
        response = api_anonymous.post("/api/payments/credit-orders", json=VALID_PURCHASE)
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/payments/smoke
# ---------------------------------------------------------------------------


class TestPagarmeSmoke:
    def test_admin_can_run_smoke(self, api_admin, fake_pagarme):
        response = api_admin.get("/api/payments/smoke")
        assert response.status_code == 200
        body = response.get_json()
        assert body.get("ok") is True

    def test_staff_can_run_smoke(self, api_staff, fake_pagarme):
        response = api_staff.get("/api/payments/smoke")
        assert response.status_code == 200

    def test_client_is_forbidden(self, api_client):
        response = api_client.get("/api/payments/smoke")
        assert response.status_code == 403

    def test_anonymous_is_401(self, api_anonymous):
        assert api_anonymous.get("/api/payments/smoke").status_code == 401


# ---------------------------------------------------------------------------
# POST /api/payments/smoke-charge  (admin/staff only)
# ---------------------------------------------------------------------------


SMOKE_CARD_PAYLOAD = {
    "method": "credit_card",
    "card_token": "card_token_smoke_99999",
    "customer": {"document": "11122233344", "phone": "11988887777"},
    "billing_address": {
        "street": "Rua",
        "number": "1",
        "neighborhood": "Centro",
        "city": "SP",
        "state": "SP",
        "zip_code": "01000000",
    },
}


class TestPagarmeSmokeCharge:
    def test_admin_can_create_smoke_charge(self, api_admin, fake_pagarme):
        response = api_admin.post("/api/payments/smoke-charge", json=SMOKE_CARD_PAYLOAD)
        assert response.status_code == 201
        # fake_pagarme registrou a chamada
        assert any(c["action"] == "smoke_charge" for c in fake_pagarme.calls)

    def test_pix_method_is_accepted(self, api_admin, fake_pagarme):
        response = api_admin.post(
            "/api/payments/smoke-charge",
            json={"method": "pix", "customer": {"document": "11122233344", "phone": "11988887777"}},
        )
        assert response.status_code == 201

    def test_invalid_method_is_400(self, api_admin):
        response = api_admin.post(
            "/api/payments/smoke-charge", json={"method": "bizarro"}
        )
        assert response.status_code == 400

    def test_client_blocked(self, api_client):
        response = api_client.post(
            "/api/payments/smoke-charge", json=SMOKE_CARD_PAYLOAD
        )
        assert response.status_code == 403

    def test_missing_document_is_400(self, api_admin, fake_pagarme):
        payload = {**SMOKE_CARD_PAYLOAD, "customer": {"phone": "11988887777"}}
        response = api_admin.post("/api/payments/smoke-charge", json=payload)
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/payments/pagarme/webhook
# (mantido apenas como verificação básica — fluxo completo testado em
#  tests/modules/webhooks/test_pagarme_webhook.py via rota dedicada)
# ---------------------------------------------------------------------------


class TestLegacyPagarmeWebhookEndpoint:
    def test_invalid_token_is_rejected(self, client):
        response = client.post(
            "/api/payments/pagarme/webhook",
            json={"id": "evt_x", "type": "order.paid"},
        )
        # Sem token nem assinatura → 401 (AuthError)
        assert response.status_code == 401
