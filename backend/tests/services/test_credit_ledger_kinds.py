"""Testes do módulo `app.services.credit_ledger`.

Valida que only common kind é aceito e que legacy_cents são isolados.
"""

from __future__ import annotations

import pytest

from app.services import credit_ledger


pytestmark = [pytest.mark.integration]


class TestComputeBalanceByKind:
    """compute_balance(kind=...) retorna saldo apenas do kind 'common'."""

    def test_returns_zero_for_user_without_transactions(self, client_user):
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

    def test_common_credit_visible_in_common_kind(self, client_user, db):
        credit_ledger.credit(
            client_user,
            amount=10,
            source="test",
            description="Common credit",
            idempotency_key="credit-1",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 10

    def test_invalid_kind_raises_ledger_error(self, client_user):
        with pytest.raises(credit_ledger.LedgerError):
            credit_ledger.compute_balance(client_user.id, kind="peticao_express")

    def test_debit_from_common_reduces_balance(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=10,
            source="test", description="Start",
            idempotency_key="start-common",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        credit_ledger.debit(
            client_user, amount=3,
            source="test", description="Use common",
            idempotency_key="debit-common",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 7


class TestComputeBalances:
    """compute_balances(user_id) retorna dict apenas com 'common'."""

    def test_returns_dict_with_common_key(self, client_user):
        balances = credit_ledger.compute_balances(client_user.id)
        assert set(balances.keys()) == {credit_ledger.KIND_COMMON}

    def test_all_zero_without_transactions(self, client_user):
        balances = credit_ledger.compute_balances(client_user.id)
        assert balances[credit_ledger.KIND_COMMON] == 0

    def test_reflects_common_credits(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=100,
            source="test", description="Common",
            idempotency_key="bal-1",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        balances = credit_ledger.compute_balances(client_user.id)
        assert balances[credit_ledger.KIND_COMMON] == 100


class TestDebitKindValidation:
    """Débito em kind inválido lança LedgerError; insufficient balance funciona."""

    def test_debit_invalid_kind_raises_ledger_error(self, client_user):
        with pytest.raises(credit_ledger.LedgerError):
            credit_ledger.debit(
                client_user, amount=1,
                source="test", description="Try express",
                idempotency_key="seg-2",
                kind="peticao_express",
            )

    def test_insufficient_balance_exception_includes_kind(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=5,
            source="test", description="Some common",
            idempotency_key="kind-exc-1",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        with pytest.raises(credit_ledger.InsufficientBalance) as exc:
            credit_ledger.debit(
                client_user, amount=10,
                source="test", description="Over-debit",
                idempotency_key="kind-exc-2",
                kind=credit_ledger.KIND_COMMON,
            )

        assert exc.value.available == 5
        assert exc.value.required == 10


class TestLegacyCentsExclusion:
    """Rows com kind=legacy_cents não entram em compute_balance de nenhum kind ativo."""

    def test_legacy_cents_not_counted_in_common(self, client_user, db):
        from app.models import CreditTransaction

        legacy_tx = CreditTransaction(
            user_id=client_user.id,
            company_id=client_user.company_id,
            type="in",
            source="legacy",
            amount=50000,
            description="Legacy cents from before migration",
            kind=credit_ledger.KIND_LEGACY_CENTS,
        )
        db.session.add(legacy_tx)
        db.session.flush()

        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

        balances = credit_ledger.compute_balances(client_user.id)
        assert balances[credit_ledger.KIND_COMMON] == 0

    def test_legacy_mixed_with_active_kinds(self, client_user, db):
        from app.models import CreditTransaction

        credit_ledger.credit(
            client_user, amount=20,
            source="test", description="Active",
            idempotency_key="mixed-1",
            kind=credit_ledger.KIND_COMMON,
        )

        legacy_tx = CreditTransaction(
            user_id=client_user.id,
            company_id=client_user.company_id,
            type="in",
            source="legacy",
            amount=99999,
            description="Legacy huge amount",
            kind=credit_ledger.KIND_LEGACY_CENTS,
        )
        db.session.add(legacy_tx)
        db.session.flush()

        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 20
