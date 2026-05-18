"""Cobertura de /api/admin/financial e /api/admin/financial/entries (+ refund)."""

from __future__ import annotations

import pytest

from app.models import CreditTransaction, FinancialEntry


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


# ---------------------------------------------------------------------------
# GET /api/admin/financial
# ---------------------------------------------------------------------------


class TestFinancialSummary:
    def test_returns_orders_and_entries(self, api_admin, client_user, admin_user, db):
        from tests.factories import create_financial_entry, create_service_order

        create_service_order(user=client_user, total_amount=100_000, status="concluido")
        create_financial_entry(actor=admin_user, kind="credit", amount_cents=20_000)
        create_financial_entry(actor=admin_user, kind="debit", amount_cents=5_000)
        db.session.commit()

        response = api_admin.get("/api/admin/financial")
        assert response.status_code == 200
        body = response.get_json()
        assert "stats" in body and "orders" in body and "entries" in body
        assert body["stats"]["concluidos"] == 1
        # receita_mes = receita_pedidos(100_000) + créditos(20_000) − débitos(5_000)
        assert body["stats"]["receita_mes"] == 100_000 + 20_000 - 5_000

    def test_client_blocked(self, api_client):
        assert api_client.get("/api/admin/financial").status_code == 403


# ---------------------------------------------------------------------------
# GET /api/admin/financial/entries
# ---------------------------------------------------------------------------


class TestEntriesList:
    def test_lists_only_active_entries(self, api_admin, admin_user, db):
        from tests.factories import create_financial_entry

        active = create_financial_entry(actor=admin_user, description="ativa")
        inactive = create_financial_entry(actor=admin_user, description="inativa")
        inactive.is_active = False
        db.session.commit()

        response = api_admin.get("/api/admin/financial/entries")
        assert response.status_code == 200
        descs = [e["description"] for e in response.get_json()["entries"]]
        assert "ativa" in descs
        assert "inativa" not in descs


# ---------------------------------------------------------------------------
# POST /api/admin/financial/entries
# ---------------------------------------------------------------------------


class TestCreateEntry:
    def test_admin_creates_credit_entry(self, api_admin):
        response = api_admin.post(
            "/api/admin/financial/entries",
            json={"description": "Receita extra", "kind": "credit", "amount_cents": 30_000},
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert body["entry"]["description"] == "Receita extra"
        assert body["entry"]["kind"] == "credit"

    def test_invalid_kind_is_400(self, api_admin):
        response = api_admin.post(
            "/api/admin/financial/entries",
            json={"description": "Bizarro", "kind": "wat", "amount_cents": 1000},
        )
        assert response.status_code == 400

    def test_missing_description_is_400(self, api_admin):
        response = api_admin.post(
            "/api/admin/financial/entries",
            json={"description": "", "kind": "credit", "amount_cents": 1000},
        )
        assert response.status_code == 400

    def test_negative_amount_is_400(self, api_admin):
        response = api_admin.post(
            "/api/admin/financial/entries",
            json={"description": "x", "kind": "credit", "amount_cents": -100},
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# GET /<id>, PUT /<id>, DELETE /<id>
# ---------------------------------------------------------------------------


class TestEntryDetailUpdateDelete:
    def test_detail_returns_entry(self, api_admin, admin_user, db):
        from tests.factories import create_financial_entry

        entry = create_financial_entry(actor=admin_user, description="Lookup")
        db.session.commit()

        response = api_admin.get(f"/api/admin/financial/entries/{entry.id}")
        assert response.status_code == 200
        assert response.get_json()["entry"]["description"] == "Lookup"

    def test_update_entry(self, api_admin, admin_user, db):
        from tests.factories import create_financial_entry

        entry = create_financial_entry(actor=admin_user, description="Original", amount_cents=1000)
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/financial/entries/{entry.id}",
            json={"description": "Atualizada", "amount_cents": 9999, "kind": "debit"},
        )
        assert response.status_code == 200
        body = response.get_json()["entry"]
        assert body["description"] == "Atualizada"
        assert body["kind"] == "debit"

    def test_update_unknown_is_404(self, api_admin):
        response = api_admin.patch(
            "/api/admin/financial/entries/999999",
            json={"description": "x"},
        )
        assert response.status_code == 404

    def test_delete_soft_deletes(self, api_admin, admin_user, db):
        from tests.factories import create_financial_entry

        entry = create_financial_entry(actor=admin_user)
        eid = entry.id
        db.session.commit()

        response = api_admin.delete(f"/api/admin/financial/entries/{eid}")
        assert response.status_code == 200
        persisted = db.session.get(FinancialEntry, eid)
        assert persisted is not None
        assert persisted.is_active is False  # soft delete


# ---------------------------------------------------------------------------
# POST /api/admin/financial/refund
# ---------------------------------------------------------------------------


class TestFinancialRefund:
    def test_admin_creates_full_refund_and_credit_transaction(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(
            user=client_user, total_amount=50_000, status="concluido"
        )
        db.session.commit()

        response = api_admin.post(
            "/api/admin/financial/refund",
            json={"order_id": order.id, "reason": "Cliente desistiu"},
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert body["refund"]["kind"] == "debit"

        # CreditTransaction de estorno foi criada para o cliente
        refund_tx = (
            CreditTransaction.query
            .filter(
                CreditTransaction.user_id == client_user.id,
                CreditTransaction.source == "admin_refund",
            )
            .first()
        )
        assert refund_tx is not None
        assert refund_tx.amount == 50_000

    def test_partial_refund_amount(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(user=client_user, total_amount=50_000)
        db.session.commit()

        response = api_admin.post(
            "/api/admin/financial/refund",
            json={"order_id": order.id, "amount_cents": 15_000, "reason": "Parcial"},
        )
        assert response.status_code == 201
        assert response.get_json()["refund"]["amount_cents"] == 15_000

    def test_refund_exceeding_total_is_400(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(user=client_user, total_amount=10_000)
        db.session.commit()

        response = api_admin.post(
            "/api/admin/financial/refund",
            json={"order_id": order.id, "amount_cents": 99_999, "reason": "x"},
        )
        assert response.status_code == 400

    def test_missing_reason_is_400(self, api_admin, client_user, db):
        from tests.factories import create_service_order

        order = create_service_order(user=client_user, total_amount=10_000)
        db.session.commit()

        response = api_admin.post(
            "/api/admin/financial/refund",
            json={"order_id": order.id, "amount_cents": 5000},
        )
        assert response.status_code == 400

    def test_missing_order_id_is_400(self, api_admin):
        response = api_admin.post("/api/admin/financial/refund", json={"reason": "x"})
        assert response.status_code == 400

    def test_unknown_order_is_404(self, api_admin):
        response = api_admin.post(
            "/api/admin/financial/refund",
            json={"order_id": 99999, "reason": "x"},
        )
        assert response.status_code == 404

    def test_refund_is_idempotent(self, api_admin, client_user, db):
        """Chamar duas vezes não cria duas CreditTransactions de estorno."""
        from tests.factories import create_service_order

        order = create_service_order(user=client_user, total_amount=10_000)
        db.session.commit()

        api_admin.post(
            "/api/admin/financial/refund",
            json={"order_id": order.id, "reason": "Razão"},
        )
        api_admin.post(
            "/api/admin/financial/refund",
            json={"order_id": order.id, "reason": "Razão"},
        )

        count = (
            CreditTransaction.query.filter(
                CreditTransaction.user_id == client_user.id,
                CreditTransaction.source == "admin_refund",
            )
            .count()
        )
        assert count == 1, "Refund duplicado deve ser idempotente"
