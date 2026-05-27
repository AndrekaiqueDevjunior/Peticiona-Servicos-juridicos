"""Testes de regressão para os bugs corrigidos durante a auditoria.

Esses testes congelam o comportamento esperado após cada fix — se alguém
reintroduzir o bug no futuro, esta suíte avisa.

Bugs cobertos:
- B-1: migrações Postgres-only (CASCADE) inviabilizando SQLite em testes
       → coberto implicitamente: se este arquivo executa, a app booto a OK.
- B-2: _default_plan() apontava para code='starter' que não existia no seed
       → coberto em tests/modules/auth/test_register.py (qualquer test_register).
- B-3: _serialize_order_for_staff tinha recursão infinita
       → test_serialize_order_for_staff_does_not_recurse.
- B-4: g.current_user vazava entre requests no test_client
       → coberto em tests/modules/client_area/test_client_flow_end_to_end.py
       (test_anonymous_cannot_download).
- B-5: _credit_amount_for_order retornava 0 quando monthly_credits_cents=0,
       e _release_order marcava released_at sem criar a CreditTransaction
       → test_paid_plan_credits_balance_when_monthly_credits_zero.
- B-6: admin_service.create_admin_plan default monthly_credits_cents=0
       → test_create_plan_without_credits_cents_defaults_to_price
       (já em tests/modules/admin/test_plans.py).
"""

from __future__ import annotations

import pytest

from app.core.extensions import db as _db
from app.models import CreditTransaction, Order, Plan, ServiceOrder, User


pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# B-3 — recursão infinita em _serialize_order_for_staff
# ---------------------------------------------------------------------------


class TestStaffOrderSerializationDoesNotRecurse:
    """Antes do fix, GET /api/staff/orders explodia com RecursionError."""

    def test_serialize_order_for_staff_does_not_recurse(
        self, api_staff, staff_user, client_user, db
    ):
        from tests.factories import create_service_order

        create_service_order(
            user=client_user,
            staff_user=staff_user,
            total_amount=100_000,
            split_funcionario=30,
            split_plataforma=70,
        )
        db.session.commit()

        response = api_staff.get("/api/staff/orders")
        # Se a recursão voltar, este request explode com 500 (TESTING=True
        # re-raise → pytest captura como erro, não como 200).
        assert response.status_code == 200, response.get_json()
        orders = response.get_json()["orders"]
        assert len(orders) == 1

        order = orders[0]
        # Staff payload NÃO pode expor o valor cheio
        assert "total_amount" not in order, (
            "REGRESSÃO B-3: serializer de staff vazou total_amount — funcionário "
            "passa a enxergar o valor cheio cobrado do cliente"
        )
        assert "total_brl" not in order
        assert "split_plataforma" not in order
        # Mas DEVE ter o repasse (split_funcionario %)
        assert order["staff_payout_cents"] == 30_000  # 30% de 100k
        assert order["staff_payout_brl"] == "R$ 300,00"

    def test_staff_financial_does_not_recurse(self, api_staff, staff_user, client_user, db):
        from tests.factories import create_service_order

        create_service_order(
            user=client_user, staff_user=staff_user, total_amount=50_000, split_funcionario=20
        )
        db.session.commit()

        response = api_staff.get("/api/staff/financial")
        assert response.status_code == 200
        body = response.get_json()
        # summary com repasse calculado
        assert body["summary"]["estimated_payout_cents"] == 10_000  # 20% de 50k


# ---------------------------------------------------------------------------
# B-5 — _credit_amount_for_order + _release_order
# ---------------------------------------------------------------------------


class TestPlanPurchaseCreditsClientBalance:
    """Regressões de liberação de créditos unitários pelo checkout."""

    def _make_paid_order(
        self,
        db,
        client_user,
        *,
        service_id,
        amount,
        credits_quantity=None,
        petition_limit_monthly=None,
        monthly_credits_cents=None,
        price_per_service_cents=None,
    ):
        """Cria diretamente uma Order paga + Plan correspondente."""
        plan = Plan.query.filter_by(code=service_id).first()
        fields = {
            "name": f"Plano {service_id}",
            "monthly_price_cents": amount,
            "monthly_credits_cents": (
                monthly_credits_cents if monthly_credits_cents is not None else amount
            ),
            "credits_quantity": credits_quantity,
            "petition_limit_monthly": petition_limit_monthly,
            "price_per_service_cents": price_per_service_cents,
            "is_active": True,
        }
        if plan is None:
            plan = Plan(code=service_id, **fields)
            db.session.add(plan)
        else:
            for key, value in fields.items():
                setattr(plan, key, value)
        db.session.flush()

        order = Order(
            user_id=client_user.id,
            company_id=client_user.company_id,
            service_id=service_id,
            amount=amount,
            status="paid",
            idempotency_key=f"test-paid-{service_id}-{client_user.id}",
        )
        db.session.add(order)
        db.session.commit()
        return order

    def test_paid_legacy_plan_uses_petition_limit_when_credits_quantity_missing(
        self, api, client_user, db, fake_pagarme
    ):
        order = self._make_paid_order(
            db,
            client_user,
            service_id="plano_quebrado",
            amount=1_000,
            credits_quantity=None,
            petition_limit_monthly=2,
            monthly_credits_cents=1_000,
            price_per_service_cents=500,
        )

        response = api(client_user).get(f"/api/checkout/status/{order.id}")
        assert response.status_code == 200

        tx = CreditTransaction.query.filter_by(
            user_id=client_user.id, source="checkout"
        ).first()
        assert tx is not None
        assert tx.amount == 2

    def test_paid_plan_uses_credits_quantity_when_set(
        self, api, client_user, db, fake_pagarme
    ):
        order = self._make_paid_order(
            db,
            client_user,
            service_id="plano_canonico",
            amount=48_000,
            credits_quantity=3,
        )

        api(client_user).get(f"/api/checkout/status/{order.id}")
        tx = CreditTransaction.query.filter_by(
            user_id=client_user.id, source="checkout"
        ).first()
        assert tx is not None
        assert tx.amount == 3

    def test_release_order_is_idempotent(self, api, client_user, db, fake_pagarme):
        order = self._make_paid_order(
            db, client_user, service_id="plano_idemp", amount=10_000, credits_quantity=1
        )

        api(client_user).get(f"/api/checkout/status/{order.id}")
        api(client_user).get(f"/api/checkout/status/{order.id}")
        api(client_user).get(f"/api/checkout/status/{order.id}")

        count = CreditTransaction.query.filter_by(
            user_id=client_user.id, source="checkout"
        ).count()
        assert count == 1, "Refresh repetido criou créditos duplicados"

    def test_status_release_recovers_stuck_paid_orders(
        self, api, client_user, db, fake_pagarme
    ):
        order = self._make_paid_order(
            db, client_user, service_id="plano_recover", amount=20_000, credits_quantity=2
        )
        assert order.released_at is None

        api(client_user).get(f"/api/checkout/status/{order.id}")

        _db.session.refresh(order)
        assert order.released_at is not None
        tx = CreditTransaction.query.filter_by(user_id=client_user.id).first()
        assert tx is not None and tx.amount == 2

    def test_balance_endpoint_reflects_credit_after_release(
        self, api, client_user, db, fake_pagarme
    ):
        order = self._make_paid_order(
            db,
            client_user,
            service_id="plano_e2e",
            amount=30_000,
            credits_quantity=4,
        )
        api(client_user).get(f"/api/checkout/status/{order.id}")

        balance = api(client_user).get("/api/me/balance")
        assert balance.status_code == 200
        body = balance.get_json()
        assert body["credits_available_cents"] == 4
        assert body["credits_available_brl"] == "4 crédito(s)"

    def test_balance_recovers_paid_legacy_plan_without_release_transaction(
        self, api_client, client_user, db
    ):
        order = self._make_paid_order(
            db,
            client_user,
            service_id="plano_teste_10_legacy",
            amount=1_000,
            credits_quantity=None,
            petition_limit_monthly=2,
            monthly_credits_cents=1_000,
            price_per_service_cents=500,
        )

        response = api_client.get("/api/me/balance")
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        assert body["balances"]["common"] == 2

        tx = CreditTransaction.query.filter_by(
            user_id=client_user.id,
            idempotency_key=f"checkout-{order.id}",
            kind="common",
        ).first()
        assert tx is not None
        assert tx.amount == 2

    def test_balance_recovery_skips_legacy_checkout_row_without_idempotency(
        self, api_client, client_user, db
    ):
        order = self._make_paid_order(
            db,
            client_user,
            service_id="plano_checkout_legacy_row",
            amount=1_000,
            credits_quantity=2,
        )
        db.session.add(
            CreditTransaction(
                user_id=client_user.id,
                company_id=client_user.company_id,
                type="in",
                source="checkout",
                amount=1_000,
                description=f"Checkout #{order.id}",
                kind="legacy_cents",
            )
        )
        db.session.commit()

        response = api_client.get("/api/me/balance")
        assert response.status_code == 200, response.get_json()
        assert response.get_json()["balances"]["common"] == 0

        checkout_rows = CreditTransaction.query.filter_by(
            user_id=client_user.id,
            source="checkout",
            description=f"Checkout #{order.id}",
        ).count()
        assert checkout_rows == 1
        assert (
            CreditTransaction.query.filter_by(
                user_id=client_user.id,
                idempotency_key=f"checkout-{order.id}",
            ).first()
            is None
        )


# ---------------------------------------------------------------------------
# B-4 — cache de g.current_user (já coberto em test_anonymous_cannot_download)
# Aqui um teste explícito reforçando o cenário "auth alternado".
# ---------------------------------------------------------------------------


class TestAuthCacheDoesNotLeakBetweenRequests:
    def test_alternating_users_resolve_to_correct_identity(
        self, api, admin_user, client_user
    ):
        """REGRESSÃO B-4: chamar /api/me como admin, depois como client,
        depois como admin no mesmo app context deve retornar identidades
        diferentes — sem leaking de g.current_user."""
        first = api(admin_user).get("/api/me").get_json()
        second = api(client_user).get("/api/me").get_json()
        third = api(admin_user).get("/api/me").get_json()

        assert first["email"] == admin_user.email
        assert second["email"] == client_user.email
        assert third["email"] == admin_user.email
        assert first["role"] == "admin"
        assert second["role"] == "client"

    def test_anonymous_after_authenticated_request_is_401(
        self, api, api_anonymous, admin_user
    ):
        """REGRESSÃO B-4 (canônico): request autenticado seguido por anônimo
        precisa receber 401, não 200."""
        api(admin_user).get("/api/me")  # autenticado
        response = api_anonymous.get("/api/me")  # mesmo app, sem token
        assert response.status_code == 401
