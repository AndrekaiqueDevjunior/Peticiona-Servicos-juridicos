"""Cobertura do fluxo de checkout: config + create-order + create-payment + status.

Pagar.me é mockado via fixture `fake_pagarme` (declarada no conftest).
"""

from __future__ import annotations

import pytest

from app.models import Order


pytestmark = [pytest.mark.checkout, pytest.mark.integration]


# ---------------------------------------------------------------------------
# GET /api/checkout/config
# ---------------------------------------------------------------------------


class TestCheckoutConfig:
    def test_returns_public_key(self, client):
        response = client.get("/api/checkout/config")
        assert response.status_code == 200
        body = response.get_json()
        # Em testes a config define pk_test_dummy
        assert "public_key" in body
        assert body["public_key"] == "pk_test_dummy"

    def test_does_not_leak_secret_key(self, client):
        response = client.get("/api/checkout/config")
        body = response.get_json()
        # Nunca deve devolver secret_key
        assert "secret_key" not in body
        assert "sk_" not in str(body)

    def test_anonymous_can_read_config(self, client):
        """A configuração precisa ser pública — o frontend usa antes do login."""
        response = client.get("/api/checkout/config")
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/checkout/create-order
# ---------------------------------------------------------------------------


class TestCreateCheckoutOrder:
    def test_client_creates_order_for_seeded_plan(self, api_client):
        response = api_client.post(
            "/api/checkout/create-order",
            json={"service_id": "plano_essencial"},
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert body["order"]["service_id"] == "plano_essencial"
        # Valor vem do seed (48000 cents)
        assert body["order"]["amount"] == 48_000
        assert body["order"]["status"] == "pending"

    def test_client_creates_order_for_avulso_service(self, api_client):
        response = api_client.post(
            "/api/checkout/create-order",
            json={"service_id": "servico_peticao"},
        )
        assert response.status_code == 201
        body = response.get_json()
        # Seed: servico_peticao tem unit_price 18000
        assert body["order"]["amount"] == 18_000

    def test_unknown_service_is_404(self, api_client):
        response = api_client.post(
            "/api/checkout/create-order",
            json={"service_id": "fantasma_xpto"},
        )
        assert response.status_code == 404

    def test_missing_service_id_is_400(self, api_client):
        response = api_client.post("/api/checkout/create-order", json={})
        assert response.status_code == 400

    def test_reuses_existing_pending_order(self, api_client):
        """Idempotência: criar duas vezes para o mesmo serviço sem pagar
        reaproveita o pedido pendente."""
        first = api_client.post(
            "/api/checkout/create-order",
            json={"service_id": "plano_essencial"},
        )
        order_id = first.get_json()["order"]["id"]

        second = api_client.post(
            "/api/checkout/create-order",
            json={"service_id": "plano_essencial"},
        )
        assert second.status_code == 200, "Pedido pendente existente deve retornar 200"
        assert second.get_json()["order"]["id"] == order_id

    def test_expected_amount_mismatch_is_400(self, api_client):
        """O frontend pode enviar `expected_amount` para detectar preço desatualizado."""
        response = api_client.post(
            "/api/checkout/create-order",
            json={"service_id": "plano_essencial", "expected_amount": 1},
        )
        assert response.status_code == 400
        assert "preço" in response.get_json()["message"].lower()

    def test_anonymous_blocked(self, api_anonymous):
        response = api_anonymous.post(
            "/api/checkout/create-order",
            json={"service_id": "plano_essencial"},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/checkout/create-payment (mockando Pagar.me)
# ---------------------------------------------------------------------------


class TestCreateCheckoutPayment:
    def _create_order(self, api_client, service_id="plano_essencial"):
        resp = api_client.post(
            "/api/checkout/create-order", json={"service_id": service_id}
        )
        return resp.get_json()["order"]

    def test_pix_payment_marks_order_paid_when_gateway_confirms(
        self, api_client, fake_pagarme
    ):
        order = self._create_order(api_client)

        response = api_client.post(
            "/api/checkout/create-payment",
            json={
                "order_id": int(order["id"]),
                "payment_method": "pix",
                "buyer": {
                    "fullName": "Joana Cliente",
                    "email": "joana@example.com",
                    "cpf": "11122233344",
                    "phone": "11988887777",
                },
            },
        )
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        assert body["order"]["status"] == "paid"
        # next_action presente — frontend mostra QR code (mesmo se já pago,
        # o helper devolve o objeto pix)
        assert "next_action" in body

        # Pagar.me foi chamado uma vez
        order_calls = [c for c in fake_pagarme.calls if c["action"] == "create_order"]
        assert len(order_calls) == 1

    def test_raw_card_data_is_rejected_at_entry(self, api_client, fake_pagarme):
        """Segurança PCI-DSS: nunca aceitar PAN/CVV brutos no payload."""
        order = self._create_order(api_client)

        response = api_client.post(
            "/api/checkout/create-payment",
            json={
                "order_id": int(order["id"]),
                "payment_method": "credit_card",
                "card": {"number": "4111111111111111", "cvv": "123"},
            },
        )
        assert response.status_code == 400
        assert "tokeniza" in response.get_json()["message"].lower()
        # Pagar.me não deve ter sido chamado
        assert all(c["action"] != "create_order" for c in fake_pagarme.calls)

    def test_cannot_pay_unknown_order(self, api_client, fake_pagarme):
        response = api_client.post(
            "/api/checkout/create-payment",
            json={
                "order_id": 999_999,
                "payment_method": "pix",
                "buyer": {
                    "fullName": "X",
                    "email": "x@y.com",
                    "cpf": "11122233344",
                    "phone": "11988887777",
                },
            },
        )
        assert response.status_code == 404

    def test_another_client_cannot_pay_for_my_order(
        self, api, client_user, fake_pagarme, db
    ):
        from tests.factories import create_client

        # cliente A cria o pedido
        first = api(client_user).post(
            "/api/checkout/create-order", json={"service_id": "plano_essencial"}
        ).get_json()["order"]

        # cliente B (outro) tenta pagar — _get_user_order escopa por user_id
        intruder = create_client(email="intruder@example.com")
        db.session.commit()

        response = api(intruder).post(
            "/api/checkout/create-payment",
            json={
                "order_id": int(first["id"]),
                "payment_method": "pix",
                "buyer": {
                    "fullName": "x",
                    "email": "x@y.com",
                    "cpf": "11122233344",
                    "phone": "11988887777",
                },
            },
        )
        assert response.status_code == 404

    def test_anonymous_blocked(self, api_anonymous):
        response = api_anonymous.post(
            "/api/checkout/create-payment", json={"order_id": 1, "payment_method": "pix"}
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/checkout/status/<id>
# ---------------------------------------------------------------------------


class TestCheckoutStatus:
    def test_returns_order_state(self, api_client, fake_pagarme):
        first = api_client.post(
            "/api/checkout/create-order", json={"service_id": "plano_essencial"}
        ).get_json()["order"]

        response = api_client.get(f"/api/checkout/status/{first['id']}")
        assert response.status_code == 200
        assert response.get_json()["order"]["id"] == first["id"]

    def test_unknown_order_is_404(self, api_client):
        assert api_client.get("/api/checkout/status/999999").status_code == 404

    def test_anonymous_blocked(self, api_anonymous):
        assert api_anonymous.get("/api/checkout/status/1").status_code == 401
