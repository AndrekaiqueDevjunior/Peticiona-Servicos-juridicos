"""Testes do endpoint GET /api/me/balance.

Valida que a resposta contém:
- balances: dict com 'common'
- totals_by_kind: dict com credits_in/out/balance
- movements: lista com campo kind
- legacy_cents rows aparecem no extrato mas saldo = 0
"""

from __future__ import annotations

import pytest

from app.services import credit_ledger


pytestmark = [pytest.mark.client, pytest.mark.integration]


class TestBalanceResponseStructure:
    """GET /api/me/balance → estrutura correta."""

    def test_response_has_balances_dict(self, api_client):
        response = api_client.get("/api/me/balance")
        assert response.status_code == 200

        body = response.get_json()
        assert "balances" in body
        balances = body["balances"]
        assert "common" in balances

    def test_response_has_totals_by_kind(self, api_client):
        response = api_client.get("/api/me/balance")
        assert response.status_code == 200

        body = response.get_json()
        assert "totals_by_kind" in body
        totals = body["totals_by_kind"]
        assert "common" in totals
        assert "credits_in" in totals["common"]
        assert "credits_out" in totals["common"]
        assert "balance" in totals["common"]

    def test_movements_have_kind_field(self, api_client, client_user, db):
        credit_ledger.credit(
            client_user,
            amount=10,
            source="test",
            description="Test credit",
            idempotency_key="mov-kind-1",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        response = api_client.get("/api/me/balance")
        assert response.status_code == 200

        body = response.get_json()
        movements = body.get("movements", [])
        assert len(movements) > 0

        for movement in movements:
            assert "kind" in movement


class TestBalancesWithKinds:
    """balances dict reflete common com valores corretos."""

    def test_common_zero_for_new_user(self, api_client):
        response = api_client.get("/api/me/balance")
        assert response.status_code == 200
        body = response.get_json()
        assert body["balances"]["common"] == 0

    def test_balances_reflect_common_credits(self, api_client, client_user, db):
        credit_ledger.credit(
            client_user, amount=100,
            source="test", description="Common",
            idempotency_key="bal-comm",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        response = api_client.get("/api/me/balance")
        assert response.status_code == 200
        body = response.get_json()
        assert body["balances"]["common"] == 100


class TestTotalsByKind:
    """totals_by_kind reflete in/out/balance corretamente."""

    def test_totals_by_kind_credits_in_out(self, api_client, client_user, db):
        credit_ledger.credit(
            client_user, amount=100,
            source="test", description="Credit in",
            idempotency_key="tot-in",
            kind=credit_ledger.KIND_COMMON,
        )
        credit_ledger.debit(
            client_user, amount=30,
            source="test", description="Credit out",
            idempotency_key="tot-out",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        response = api_client.get("/api/me/balance")
        assert response.status_code == 200

        body = response.get_json()
        totals = body["totals_by_kind"]["common"]
        assert totals["credits_in"] == 100
        assert totals["credits_out"] == 30
        assert totals["balance"] == 70


class TestLegacyCentsInMovements:
    """legacy_cents rows aparecem em movements mas saldo = 0."""

    def test_legacy_cents_in_movements_but_not_in_balance(self, api_client, client_user, db):
        from app.models import CreditTransaction

        legacy = CreditTransaction(
            user_id=client_user.id,
            company_id=client_user.company_id,
            type="in",
            source="legacy_import",
            amount=50000,
            description="Legacy cents from migration",
            kind=credit_ledger.KIND_LEGACY_CENTS,
        )
        db.session.add(legacy)
        db.session.flush()

        response = api_client.get("/api/me/balance")
        assert response.status_code == 200

        body = response.get_json()
        movements = body.get("movements", [])
        legacy_movements = [m for m in movements if m["kind"] == "legacy_cents"]
        assert len(legacy_movements) > 0

        assert body["balances"]["common"] == 0


class TestLegacyCompatibilityFields:
    """Campos legados credits_available, etc. ainda presentes para compat."""

    def test_legacy_fields_present(self, api_client, client_user, db):
        credit_ledger.credit(
            client_user, amount=10,
            source="test", description="For compat check",
            idempotency_key="compat-1",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        response = api_client.get("/api/me/balance")
        assert response.status_code == 200

        body = response.get_json()
        assert "credits_available" in body
        assert "credits_available_brl" in body
        assert "credits_total" in body
        assert "credits_used" in body


class TestAnonymousAccess:
    """GET /api/me/balance sem autenticação → 401."""

    def test_anonymous_returns_401(self, api_anonymous):
        response = api_anonymous.get("/api/me/balance")
        assert response.status_code == 401
