"""Cobertura adicional de /api/client-area (preview, cancel, catalog, documents)."""

from __future__ import annotations

import pytest

from app.models import ServiceOrder


pytestmark = [pytest.mark.client, pytest.mark.integration]


# ---------------------------------------------------------------------------
# GET /api/client-area  (catálogo público, sem auth)
# ---------------------------------------------------------------------------


class TestClientAreaCatalog:
    def test_returns_catalog_sections(self, client):
        response = client.get("/api/client-area")
        assert response.status_code == 200
        body = response.get_json()
        assert "catalog" in body
        # Seed canônico cria itens nas seções "Petições" e "Recursos"
        sections = {s["section"] for s in body["catalog"]}
        assert "Petições" in sections


# ---------------------------------------------------------------------------
# POST /api/client-area/cart/preview
# ---------------------------------------------------------------------------


class TestCartPreview:
    def test_valid_cart_returns_totals(self, client):
        response = client.post(
            "/api/client-area/cart/preview",
            json={"items": [{"code": "servico_peticao", "quantity": 2}]},
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["is_valid"] is True
        # servico_peticao no seed = 18000 cents, x2 = 36000
        assert body["total_amount"] == 36_000
        assert body["total_brl"] == "R$ 360,00"

    def test_empty_cart_is_400(self, client):
        response = client.post("/api/client-area/cart/preview", json={"items": []})
        assert response.status_code == 400

    def test_unknown_code_is_404(self, client):
        response = client.post(
            "/api/client-area/cart/preview",
            json={"items": [{"code": "nada", "quantity": 1}]},
        )
        assert response.status_code == 404

    def test_zero_quantity_is_400(self, client):
        response = client.post(
            "/api/client-area/cart/preview",
            json={"items": [{"code": "servico_peticao", "quantity": 0}]},
        )
        assert response.status_code == 400

    def test_negative_quantity_is_400(self, client):
        response = client.post(
            "/api/client-area/cart/preview",
            json={"items": [{"code": "servico_peticao", "quantity": -1}]},
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/client-area/orders/preview
# ---------------------------------------------------------------------------


class TestServiceRequestPreview:
    def test_preview_for_known_tipo(self, api_client):
        response = api_client.post(
            "/api/client-area/orders/preview",
            json={"tipo_peticao": "Petição inicial comum"},
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["is_valid"] is True
        assert body["total_amount"] > 0

    def test_missing_title_is_400(self, api_client):
        response = api_client.post("/api/client-area/orders/preview", json={})
        assert response.status_code == 400

    def test_anonymous_blocked(self, api_anonymous):
        response = api_anonymous.post(
            "/api/client-area/orders/preview",
            json={"tipo_peticao": "X"},
        )
        # Rota tem @roles_required("client") → 401 sem auth
        assert response.status_code in (401, 403)


# ---------------------------------------------------------------------------
# DELETE /api/client-area/orders/<id>  (cancel)
# ---------------------------------------------------------------------------


@pytest.fixture
def client_order(db, client_user):
    from tests.factories import create_service_order

    order = create_service_order(user=client_user, status="pendente", total_amount=18_000)
    db.session.commit()
    return order


class TestCancelClientOrder:
    def test_client_cancels_own_pending_order(self, api_client, client_order, db):
        response = api_client.delete(f"/api/client-area/orders/{client_order.id}")
        assert response.status_code == 200
        body = response.get_json()
        assert body["deleted"] is True
        db.session.refresh(client_order)
        assert client_order.status == "cancelado"

    def test_cannot_cancel_concluded(self, api_client, client_order, db):
        client_order.status = "concluido"
        db.session.commit()
        response = api_client.delete(f"/api/client-area/orders/{client_order.id}")
        assert response.status_code == 400

    def test_cancel_other_clients_order_is_404(self, api, db, client_order):
        from tests.factories import create_client

        intruder = create_client(email="z@y.com")
        db.session.commit()

        response = api(intruder).delete(
            f"/api/client-area/orders/{client_order.id}"
        )
        assert response.status_code == 404

    def test_cancel_refunds_credits_when_order_had_debit(
        self, api_client, client_user, db
    ):
        """Se o pedido foi pago via débito de crédito, cancelar deve gerar refund."""
        from app.models import CreditTransaction
        from tests.factories import create_credit_transaction, create_service_order

        # cliente tem saldo + débito do pedido (simulando fluxo real)
        create_credit_transaction(user=client_user, amount=100_000, type="in", source="seed")
        order = create_service_order(
            user=client_user, total_amount=20_000, status="pendente", reference="REFUND-1"
        )
        db.session.add(
            CreditTransaction(
                user_id=client_user.id,
                company_id=client_user.company_id,
                type="out",
                source="client_order",
                amount=20_000,
                description=f"Pedido — {order.reference}",
            )
        )
        db.session.commit()

        response = api_client.delete(f"/api/client-area/orders/{order.id}")
        assert response.status_code == 200

        # CreditTransaction de estorno foi criada
        refund = CreditTransaction.query.filter_by(
            user_id=client_user.id, source="client_order_refund"
        ).first()
        assert refund is not None
        assert refund.amount == 20_000


# ---------------------------------------------------------------------------
# Documentos: upload + delete + scoping
# ---------------------------------------------------------------------------


class TestDeleteClientDocument:
    def test_delete_own_unlinked_document(self, api_client, client_user, db):
        from tests.factories import create_document

        doc = create_document(user=client_user, file_name="livre.pdf")
        doc_id = doc.id
        db.session.commit()

        response = api_client.delete(f"/api/client-area/documents/{doc_id}")
        assert response.status_code == 200

    def test_cannot_delete_other_users_document(self, api_client, db):
        from tests.factories import create_client, create_document

        other = create_client(email="alheio@example.com")
        doc = create_document(user=other, file_name="alheio.pdf")
        db.session.commit()

        response = api_client.delete(f"/api/client-area/documents/{doc.id}")
        assert response.status_code == 404

    def test_cannot_delete_document_linked_to_petition(
        self, api_client, client_user, db
    ):
        from app.models import PetitionDocumentLink
        from tests.factories import create_document, create_petition

        doc = create_document(user=client_user, file_name="anexado.pdf")
        petition = create_petition(user=client_user)
        db.session.add(
            PetitionDocumentLink(
                petition_id=petition.id,
                document_id=doc.id,
                company_id=client_user.company_id,
            )
        )
        db.session.commit()

        response = api_client.delete(f"/api/client-area/documents/{doc.id}")
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# GET /api/client-area/checkout-orders  (Order do checkout)
# ---------------------------------------------------------------------------


class TestCheckoutOrdersListing:
    def test_lists_own_checkout_orders(self, api_client, client_user, db):
        from app.models import Order

        order = Order(
            user_id=client_user.id,
            company_id=client_user.company_id,
            service_id="plano_essencial",
            amount=48_000,
            status="pending",
            idempotency_key="x1",
        )
        db.session.add(order)
        db.session.commit()

        response = api_client.get("/api/client-area/checkout-orders")
        assert response.status_code == 200
        orders = response.get_json()["orders"]
        assert any(int(o["id"]) == order.id for o in orders)

    def test_cancel_pending_checkout_order(self, api_client, client_user, db):
        from app.models import Order

        order = Order(
            user_id=client_user.id,
            company_id=client_user.company_id,
            service_id="plano_essencial",
            amount=48_000,
            status="pending",
            idempotency_key="x2",
        )
        db.session.add(order)
        db.session.commit()

        response = api_client.delete(f"/api/client-area/checkout-orders/{order.id}")
        assert response.status_code == 200
        db.session.refresh(order)
        assert order.status == "canceled"

    def test_cannot_cancel_paid_checkout_order(self, api_client, client_user, db):
        from app.models import Order

        order = Order(
            user_id=client_user.id,
            company_id=client_user.company_id,
            service_id="plano_essencial",
            amount=48_000,
            status="paid",
            idempotency_key="x3",
        )
        db.session.add(order)
        db.session.commit()

        response = api_client.delete(f"/api/client-area/checkout-orders/{order.id}")
        assert response.status_code == 400
