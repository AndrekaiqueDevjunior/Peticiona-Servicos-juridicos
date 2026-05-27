"""Cobertura de /api/admin/credit-purchases (listagem + refund via Pagar.me)."""

from __future__ import annotations

import pytest

from app.models import CreditPurchase, CreditTransaction


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


# ---------------------------------------------------------------------------
# GET /api/admin/credit-purchases
# ---------------------------------------------------------------------------


class TestListCreditPurchases:
    def test_admin_lists_credit_purchases(self, api_admin, client_user, db):
        from tests.factories import create_credit_purchase

        create_credit_purchase(user=client_user, package_name="Pack A", amount_cents=10_000)
        create_credit_purchase(user=client_user, package_name="Pack B", amount_cents=20_000)
        db.session.commit()

        response = api_admin.get("/api/admin/credit-purchases")
        assert response.status_code == 200
        purchases = response.get_json()["purchases"]
        names = {p["package_name"] for p in purchases}
        assert "Pack A" in names and "Pack B" in names

    def test_list_includes_checkout_orders(self, api_admin, client_user, db):
        """Após o fix recente em list_admin_credit_purchases, Orders do checkout
        devem aparecer no painel financeiro do admin."""
        from app.models import Order

        order = Order(
            user_id=client_user.id,
            company_id=client_user.company_id,
            service_id="plano_essencial",
            amount=48_000,
            status="paid",
            idempotency_key="idemp-test-list",
        )
        db.session.add(order)
        db.session.commit()

        response = api_admin.get("/api/admin/credit-purchases")
        assert response.status_code == 200
        purchases = response.get_json()["purchases"]
        codes = [p["code"] for p in purchases]
        assert f"checkout-{order.id}" in codes, (
            "Compras de plano via /checkout devem entrar no painel admin "
            "(regressão do fix do bug do split-financial)"
        )

    def test_client_blocked(self, api_client):
        assert api_client.get("/api/admin/credit-purchases").status_code == 403

    def test_staff_blocked(self, api_staff):
        assert api_staff.get("/api/admin/credit-purchases").status_code == 403


# ---------------------------------------------------------------------------
# POST /api/admin/credit-purchases/<id>/refund
# ---------------------------------------------------------------------------


class TestRefundCreditPurchase:
    def test_admin_refunds_paid_purchase(self, api_admin, client_user, db, fake_pagarme):
        from tests.factories import create_credit_purchase

        fake_pagarme.status = "canceled"  # cancel_charge devolve {status: "canceled"}
        purchase = create_credit_purchase(
            user=client_user,
            amount_cents=30_000,
            credit_cents=30_000,
            status="paid",
            pagarme_charge_id="ch_test_paid",
        )
        db.session.commit()

        response = api_admin.post(f"/api/admin/credit-purchases/{purchase.id}/refund")
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        assert body["refunded"] is True

        db.session.refresh(purchase)
        assert purchase.status == "refunded"

        # CreditTransaction reversa criada
        reversal = (
            CreditTransaction.query.filter(
                CreditTransaction.user_id == client_user.id,
                CreditTransaction.type == "out",
            )
            .first()
        )
        assert reversal is not None
        assert reversal.amount == 1

        # fake_pagarme registrou a chamada
        calls = [c for c in fake_pagarme.calls if c["action"] == "cancel_charge"]
        assert len(calls) == 1
        assert calls[0]["payload"]["charge_id"] == "ch_test_paid"

    def test_refund_unknown_is_404(self, api_admin, fake_pagarme):
        response = api_admin.post("/api/admin/credit-purchases/99999/refund")
        assert response.status_code == 404

    def test_already_refunded_is_409(self, api_admin, client_user, db, fake_pagarme):
        from tests.factories import create_credit_purchase

        purchase = create_credit_purchase(
            user=client_user, status="refunded", pagarme_charge_id="ch_x"
        )
        db.session.commit()
        response = api_admin.post(f"/api/admin/credit-purchases/{purchase.id}/refund")
        assert response.status_code == 409

    def test_pending_purchase_cannot_be_refunded(self, api_admin, client_user, db, fake_pagarme):
        from tests.factories import create_credit_purchase

        purchase = create_credit_purchase(
            user=client_user, status="pending", pagarme_charge_id="ch_x"
        )
        db.session.commit()
        response = api_admin.post(f"/api/admin/credit-purchases/{purchase.id}/refund")
        assert response.status_code == 400

    def test_without_charge_id_is_400(self, api_admin, client_user, db, fake_pagarme):
        from tests.factories import create_credit_purchase

        purchase = create_credit_purchase(
            user=client_user, status="paid", pagarme_charge_id=None
        )
        db.session.commit()
        response = api_admin.post(f"/api/admin/credit-purchases/{purchase.id}/refund")
        assert response.status_code == 400

    def test_gateway_unexpected_status_is_400(self, api_admin, client_user, db, fake_pagarme):
        """Se Pagar.me devolver status fora de {canceled, refunded, voided},
        o estorno é rejeitado."""
        from tests.factories import create_credit_purchase

        fake_pagarme.cancel_status = "paid"  # ainda paid após cancel → inesperado
        purchase = create_credit_purchase(
            user=client_user, status="paid", pagarme_charge_id="ch_x"
        )
        db.session.commit()

        response = api_admin.post(f"/api/admin/credit-purchases/{purchase.id}/refund")
        assert response.status_code == 400
        db.session.refresh(purchase)
        assert purchase.status == "paid", "Estorno só deve persistir se gateway confirmar"

    def test_client_blocked_for_refund(self, api_client, client_user, db, fake_pagarme):
        from tests.factories import create_credit_purchase

        purchase = create_credit_purchase(
            user=client_user, status="paid", pagarme_charge_id="ch_x"
        )
        db.session.commit()
        response = api_client.post(f"/api/admin/credit-purchases/{purchase.id}/refund")
        assert response.status_code == 403


class TestRefundCheckoutOrderPurchase:
    def test_admin_refunds_checkout_order_purchase(self, api_admin, client_user, db, fake_pagarme):
        from app.models import Order
        from app.models.base import utcnow
        from app.services import credit_ledger
        from tests.factories import create_plan

        plan = create_plan(
            code="plano_checkout_refund",
            monthly_price_cents=1_000,
            credits_quantity=2,
        )
        order = Order(
            user_id=client_user.id,
            company_id=client_user.company_id,
            service_id=plan.code,
            amount=1_000,
            status="paid",
            idempotency_key="checkout-refund-test",
            pagarme_order_id="or_checkout_refund",
            pagarme_charge_id="ch_checkout_refund",
            paid_at=utcnow(),
            released_at=utcnow(),
        )
        db.session.add(order)
        db.session.flush()
        credit_ledger.credit(
            client_user,
            amount=2,
            source="checkout",
            description=f"Checkout #{order.id}",
            idempotency_key=f"checkout-{order.id}",
            company_id=client_user.company_id,
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.commit()

        response = api_admin.post(f"/api/admin/checkout-orders/{order.id}/refund")
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        assert body["refunded"] is True

        db.session.refresh(order)
        assert order.status == "refunded"

        reversal = CreditTransaction.query.filter_by(
            user_id=client_user.id,
            source="checkout_refund",
            type="out",
            kind="common",
        ).first()
        assert reversal is not None
        assert reversal.amount == 2

        calls = [c for c in fake_pagarme.calls if c["action"] == "cancel_charge"]
        assert len(calls) == 1
        assert calls[0]["payload"]["charge_id"] == "ch_checkout_refund"
