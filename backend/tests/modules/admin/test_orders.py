"""Cobertura de /api/admin/orders (CRUD + status update + RBAC)."""

from __future__ import annotations

import pytest

from app.models import ServiceOrder


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _order_payload(client_user, **overrides):
    base = {
        "user_id": client_user.id,
        "status": "pendente",
        "valor": 15_000,
        "tipo_servico": "Petição Inicial",
        "split_plataforma": 70,
        "split_funcionario": 30,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# GET /api/admin/orders
# ---------------------------------------------------------------------------


class TestListOrders:
    def test_admin_lists_all_orders(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        create_service_order(user=client_user, total_amount=20_000)
        create_service_order(user=client_user, total_amount=30_000)
        db.session.commit()

        response = api_admin.get("/api/admin/orders")
        assert response.status_code == 200
        body = response.get_json()
        assert "orders" in body
        assert len(body["orders"]) >= 2

    def test_client_blocked(self, api_client):
        assert api_client.get("/api/admin/orders").status_code == 403

    def test_staff_blocked(self, api_staff):
        assert api_staff.get("/api/admin/orders").status_code == 403

    def test_anonymous_blocked(self, api_anonymous):
        assert api_anonymous.get("/api/admin/orders").status_code == 401


# ---------------------------------------------------------------------------
# POST /api/admin/orders
# ---------------------------------------------------------------------------


class TestCreateOrder:
    def test_admin_creates_order_with_full_payload(self, api_admin, client_user):
        response = api_admin.post(
            "/api/admin/orders",
            json=_order_payload(client_user, numero="REF-MANUAL-1"),
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        # O serializer do admin usa as chaves em PT (numero/valor/cliente).
        assert body["order"]["numero"] == "REF-MANUAL-1"
        assert body["order"]["split_funcionario"] == 30
        assert body["order"]["valor"] == 15_000

    def test_creates_with_auto_generated_reference(self, api_admin, client_user):
        response = api_admin.post(
            "/api/admin/orders",
            json=_order_payload(client_user),  # sem 'numero'
        )
        assert response.status_code == 201
        ref = response.get_json()["order"]["numero"]
        assert ref.startswith("ADM-")

    def test_user_id_required(self, api_admin):
        response = api_admin.post("/api/admin/orders", json={"valor": 1000})
        assert response.status_code == 400
        assert response.get_json()["error"] == "VALIDATION_ERROR"

    def test_unknown_user_returns_404(self, api_admin):
        response = api_admin.post(
            "/api/admin/orders",
            json={"user_id": 999999, "valor": 1000},
        )
        assert response.status_code == 404

    def test_user_must_be_client_role(self, api_admin, staff_user):
        # Tentar criar pedido para um staff (não-cliente) deve falhar
        response = api_admin.post(
            "/api/admin/orders",
            json={"user_id": staff_user.id, "valor": 1000},
        )
        assert response.status_code == 404

    def test_invalid_status_returns_400(self, api_admin, client_user):
        response = api_admin.post(
            "/api/admin/orders",
            json=_order_payload(client_user, status="bizarro"),
        )
        assert response.status_code == 400

    def test_split_must_total_100(self, api_admin, client_user):
        response = api_admin.post(
            "/api/admin/orders",
            json=_order_payload(client_user, split_plataforma=60, split_funcionario=30),
        )
        assert response.status_code == 400
        assert "100" in response.get_json()["message"]

    def test_negative_split_rejected(self, api_admin, client_user):
        response = api_admin.post(
            "/api/admin/orders",
            json=_order_payload(client_user, split_plataforma=110, split_funcionario=-10),
        )
        assert response.status_code == 400

    def test_staff_user_must_be_staff_role(self, api_admin, client_user):
        # staff_user_id apontando para um client deve falhar
        response = api_admin.post(
            "/api/admin/orders",
            json=_order_payload(client_user, staff_user_id=client_user.id),
        )
        assert response.status_code == 404

    def test_client_cannot_create_admin_order(self, api_client, client_user):
        response = api_client.post(
            "/api/admin/orders",
            json=_order_payload(client_user),
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/admin/orders/<id>
# ---------------------------------------------------------------------------


class TestGetOrderDetail:
    def test_returns_full_order(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(user=client_user, total_amount=12_000)
        db.session.commit()

        response = api_admin.get(f"/api/admin/orders/{order.id}")
        assert response.status_code == 200
        body = response.get_json()
        assert body["order"]["id"] == order.id

    def test_unknown_id_is_404(self, api_admin):
        assert api_admin.get("/api/admin/orders/999999").status_code == 404


# ---------------------------------------------------------------------------
# PUT/PATCH /api/admin/orders/<id>
# ---------------------------------------------------------------------------


class TestUpdateOrder:
    def test_update_status_and_split(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(user=client_user, total_amount=10_000)
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/orders/{order.id}",
            json={
                "status": "em_andamento",
                "split_plataforma": 50,
                "split_funcionario": 50,
            },
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["order"]["status"] == "em_andamento"
        assert body["order"]["split_funcionario"] == 50

    def test_reference_uniqueness_violation_is_409(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        a = create_service_order(user=client_user, reference="UNIQUE-A")
        b = create_service_order(user=client_user, reference="UNIQUE-B")
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/orders/{b.id}",
            json={"numero": "UNIQUE-A"},
        )
        assert response.status_code == 409


# ---------------------------------------------------------------------------
# PATCH /api/admin/orders/<id>/status (rota dedicada)
# ---------------------------------------------------------------------------


class TestUpdateOrderStatus:
    def test_admin_patch_status_route(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(user=client_user, status="pendente")
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/orders/{order.id}/status",
            json={"status": "concluido"},
        )
        assert response.status_code == 200, response.get_json()
        assert response.get_json()["order"]["status"] == "concluido"


# ---------------------------------------------------------------------------
# DELETE /api/admin/orders/<id>
# ---------------------------------------------------------------------------


class TestDeleteOrder:
    def test_admin_deletes_order(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(user=client_user)
        order_id = order.id
        db.session.commit()

        response = api_admin.delete(f"/api/admin/orders/{order_id}")
        assert response.status_code == 204
        assert db.session.get(ServiceOrder, order_id) is None

    def test_delete_unknown_is_404(self, api_admin):
        assert api_admin.delete("/api/admin/orders/999999").status_code == 404

    def test_client_blocked(self, api_client, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(user=client_user)
        db.session.commit()
        assert api_client.delete(f"/api/admin/orders/{order.id}").status_code == 403
