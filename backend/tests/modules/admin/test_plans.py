"""Cobertura de /api/admin/plans (CRUD + regressão do bug do crédito 1:1)."""

from __future__ import annotations

import pytest

from app.models import Plan


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


class TestListPlans:
    def test_admin_lists_plans_and_single_services(self, api_admin):
        """O seed canônico cria 3 planos e 4 serviços avulsos."""
        response = api_admin.get("/api/admin/plans")
        assert response.status_code == 200
        body = response.get_json()
        # Estrutura combinada usada pelo frontend AdminPlans.tsx
        assert "plans" in body and "single_services" in body
        codes = {p["code"] for p in body["plans"]}
        assert "plano_essencial" in codes

    def test_client_blocked(self, api_client):
        assert api_client.get("/api/admin/plans").status_code == 403


class TestCreatePlan:
    def test_creates_with_explicit_credit_cents(self, api_admin):
        response = api_admin.post(
            "/api/admin/plans",
            json={
                "code": "plano_premium",
                "name": "Plano Premium",
                "monthly_price_cents": 100_000,
                "monthly_credits_cents": 120_000,
                "petition_limit_monthly": 10,
            },
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()["plan"]
        assert body["code"] == "plano_premium"
        assert body["monthly_credits_cents"] == 120_000

    def test_default_monthly_credits_equals_monthly_price(self, api_admin):
        """REGRESSÃO: criar plano sem `monthly_credits_cents` deve manter
        paridade 1:1 com `monthly_price_cents`. Antes do fix, ficava em 0
        e a compra do plano não creditava saldo nenhum no cliente."""
        response = api_admin.post(
            "/api/admin/plans",
            json={
                "code": "plano_default_credits",
                "name": "Plano Default Credits",
                "monthly_price_cents": 25_000,
                # monthly_credits_cents OMITIDO
            },
        )
        assert response.status_code == 201, response.get_json()
        plan = response.get_json()["plan"]
        assert plan["monthly_credits_cents"] == 25_000, (
            "REGRESSÃO: plan.monthly_credits_cents deve cair para monthly_price_cents "
            "quando admin não informa explicitamente (bug do plano R$ 15 que pagava "
            "mas não creditava saldo do cliente)."
        )

    def test_default_credits_when_value_is_zero(self, api_admin):
        """Mesmo se o admin enviar zero explicitamente, o backend protege
        e usa monthly_price_cents como fallback."""
        response = api_admin.post(
            "/api/admin/plans",
            json={
                "code": "plano_zero",
                "name": "Plano Zero",
                "monthly_price_cents": 15_000,
                "monthly_credits_cents": 0,
            },
        )
        assert response.status_code == 201
        assert response.get_json()["plan"]["monthly_credits_cents"] == 15_000

    def test_duplicate_code_is_409(self, api_admin):
        api_admin.post(
            "/api/admin/plans",
            json={"code": "plano_unique", "name": "X", "monthly_price_cents": 1000},
        )
        second = api_admin.post(
            "/api/admin/plans",
            json={"code": "plano_unique", "name": "Y", "monthly_price_cents": 2000},
        )
        assert second.status_code == 409

    def test_missing_code_is_400(self, api_admin):
        response = api_admin.post(
            "/api/admin/plans", json={"name": "Sem código", "monthly_price_cents": 1000}
        )
        assert response.status_code == 400

    def test_missing_name_is_400(self, api_admin):
        response = api_admin.post(
            "/api/admin/plans", json={"code": "plano_x", "monthly_price_cents": 1000}
        )
        assert response.status_code == 400

    def test_client_blocked(self, api_client):
        response = api_client.post(
            "/api/admin/plans", json={"code": "plano_y", "name": "Y", "monthly_price_cents": 1000}
        )
        assert response.status_code == 403


class TestUpdateAndDeletePlan:
    def test_update_plan_changes_price(self, api_admin, db):
        from tests.factories import create_plan

        plan = create_plan(monthly_price_cents=10_000)
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/plans/{plan.id}",
            json={"monthly_price_cents": 22_000, "is_active": False},
        )
        assert response.status_code == 200
        body = response.get_json()["plan"]
        assert body["monthly_price_cents"] == 22_000
        assert body["is_active"] is False

    def test_get_unknown_is_404(self, api_admin):
        assert api_admin.get("/api/admin/plans/999999").status_code == 404

    def test_delete_unknown_is_404(self, api_admin):
        assert api_admin.delete("/api/admin/plans/999999").status_code == 404

    def test_admin_deletes_plan_soft_or_hard(self, api_admin, db):
        from tests.factories import create_plan

        plan = create_plan(code="plano_to_del", monthly_price_cents=1000)
        plan_id = plan.id
        db.session.commit()

        response = api_admin.delete(f"/api/admin/plans/{plan_id}")
        assert response.status_code in (200, 204)
        # Plano pode ser soft-deleted (is_active=False) OU removido — ambos OK
        remaining = db.session.get(Plan, plan_id)
        if remaining is not None:
            assert remaining.is_active is False
