"""Testes do módulo `app.services.credit_ledger` com kinds segregados.

Valida que os 3 kinds (common, peticao_express, recurso_express) nunca se misturam
e que rows com kind=legacy_cents são isoladas dos saldos ativos.
"""

from __future__ import annotations

import pytest

from app.services import credit_ledger


pytestmark = [pytest.mark.integration]


class TestComputeBalanceByKind:
    """compute_balance(kind=...) retorna saldo apenas daquele kind."""

    def test_returns_zero_for_user_without_transactions(self, client_user):
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_PETICAO_EXPRESS) == 0
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_RECURSO_EXPRESS) == 0

    def test_common_credit_visible_only_in_common_kind(self, client_user, db):
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
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_PETICAO_EXPRESS) == 0
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_RECURSO_EXPRESS) == 0

    def test_express_credits_segregated(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=5,
            source="test", description="Pet express",
            idempotency_key="pet-exp",
            kind=credit_ledger.KIND_PETICAO_EXPRESS,
        )
        credit_ledger.credit(
            client_user, amount=3,
            source="test", description="Rec express",
            idempotency_key="rec-exp",
            kind=credit_ledger.KIND_RECURSO_EXPRESS,
        )
        db.session.flush()

        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_PETICAO_EXPRESS) == 5
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_RECURSO_EXPRESS) == 3

    def test_debit_from_common_only_affects_common(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=10,
            source="test", description="Start",
            idempotency_key="start-common",
            kind=credit_ledger.KIND_COMMON,
        )
        credit_ledger.credit(
            client_user, amount=5,
            source="test", description="Start express",
            idempotency_key="start-express",
            kind=credit_ledger.KIND_PETICAO_EXPRESS,
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
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_PETICAO_EXPRESS) == 5


class TestComputeBalances:
    """compute_balances(user_id) retorna dict com os 3 kinds."""

    def test_returns_dict_with_three_keys(self, client_user):
        balances = credit_ledger.compute_balances(client_user.id)
        assert set(balances.keys()) == {
            credit_ledger.KIND_COMMON,
            credit_ledger.KIND_PETICAO_EXPRESS,
            credit_ledger.KIND_RECURSO_EXPRESS,
        }

    def test_all_zero_without_transactions(self, client_user):
        balances = credit_ledger.compute_balances(client_user.id)
        assert balances[credit_ledger.KIND_COMMON] == 0
        assert balances[credit_ledger.KIND_PETICAO_EXPRESS] == 0
        assert balances[credit_ledger.KIND_RECURSO_EXPRESS] == 0

    def test_reflects_all_three_kinds(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=100,
            source="test", description="Common",
            idempotency_key="bal-1",
            kind=credit_ledger.KIND_COMMON,
        )
        credit_ledger.credit(
            client_user, amount=50,
            source="test", description="Pet exp",
            idempotency_key="bal-2",
            kind=credit_ledger.KIND_PETICAO_EXPRESS,
        )
        credit_ledger.credit(
            client_user, amount=25,
            source="test", description="Rec exp",
            idempotency_key="bal-3",
            kind=credit_ledger.KIND_RECURSO_EXPRESS,
        )
        db.session.flush()

        balances = credit_ledger.compute_balances(client_user.id)
        assert balances[credit_ledger.KIND_COMMON] == 100
        assert balances[credit_ledger.KIND_PETICAO_EXPRESS] == 50
        assert balances[credit_ledger.KIND_RECURSO_EXPRESS] == 25


class TestDebitKindSegregation:
    """Débito em um kind não afeta outro; InsufficientBalance respeita kind."""

    def test_debit_wrong_kind_raises_insufficient_balance(self, client_user, db):
        # Credita apenas common
        credit_ledger.credit(
            client_user, amount=10,
            source="test", description="Common only",
            idempotency_key="seg-1",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        # Tenta debitar express sem ter saldo express
        with pytest.raises(credit_ledger.InsufficientBalance) as exc:
            credit_ledger.debit(
                client_user, amount=1,
                source="test", description="Try express",
                idempotency_key="seg-2",
                kind=credit_ledger.KIND_PETICAO_EXPRESS,
            )

        assert exc.value.available == 0
        assert exc.value.required == 1

        # Saldo common intacto
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 10

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

        # Exception deve ter available e required
        assert exc.value.available == 5
        assert exc.value.required == 10


class TestLegacyCentsExclusion:
    """Rows com kind=legacy_cents não entram em compute_balance de nenhum kind ativo."""

    def test_legacy_cents_not_counted_in_common(self, client_user, db):
        from app.models import CreditTransaction

        # Insere uma transação legacy_cents diretamente (simulando dados pré-migração)
        legacy_tx = CreditTransaction(
            user_id=client_user.id,
            company_id=client_user.company_id,
            type="in",
            source="legacy",
            amount=50000,  # 50000 centavos em valor antigo
            description="Legacy cents from before migration",
            kind=credit_ledger.KIND_LEGACY_CENTS,
        )
        db.session.add(legacy_tx)
        db.session.flush()

        # compute_balance para common deve ser 0 (legacy não conta)
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

        # compute_balances também não deve contar
        balances = credit_ledger.compute_balances(client_user.id)
        assert balances[credit_ledger.KIND_COMMON] == 0
        assert balances[credit_ledger.KIND_PETICAO_EXPRESS] == 0
        assert balances[credit_ledger.KIND_RECURSO_EXPRESS] == 0

    def test_legacy_mixed_with_active_kinds(self, client_user, db):
        from app.models import CreditTransaction

        # Add active common credit
        credit_ledger.credit(
            client_user, amount=20,
            source="test", description="Active",
            idempotency_key="mixed-1",
            kind=credit_ledger.KIND_COMMON,
        )

        # Add legacy_cents (should be ignored)
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

        # Common should only count the 20, not the 99999 legacy
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 20
