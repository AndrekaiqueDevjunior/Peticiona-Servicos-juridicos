"""Testes do módulo `app.services.credit_ledger`.

Cobre as 6 brechas mapeadas no diagnóstico (ver docstring do
``credit_ledger.py``):

  1. Divergência de regra na soma → ``compute_balance`` rejeita ``type``
     fora do whitelist com ``LedgerCorruption``.
  2. Race em débito → testa que dois débitos sequenciais respeitam o
     gate de saldo (em SQLite, a concorrência real é simulada pela
     ordem; em Postgres o advisory lock é o que garante).
  3. Replay de network → mesma ``idempotency_key`` repetida devolve o
     registro original sem inserir nada novo.
  4. Estorno duplicado → ``refund`` com mesma idempotency_key não
     duplica; sem chave, two refunds geram duas linhas (esperado).
  5. Saldo negativo orfão → INSERT que deixaria saldo negativo é
     bloqueado, exceto quando ``allow_negative_balance=True``.
  6. Tipos textuais sem CHECK → o gate de aplicação recusa qualquer
     ``type`` fora de ``{'in','out'}``; tentativa de ``CreditTransaction``
     direto com `type='credit'` legacy é detectada na próxima leitura.
"""

from __future__ import annotations

import pytest

from app.models import CreditTransaction
from app.services import credit_ledger


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _balance(user) -> int:
    return credit_ledger.compute_balance(user.id)


# ---------------------------------------------------------------------------
# 1. Regra única de soma — compute_balance é a fonte de verdade
# ---------------------------------------------------------------------------


class TestComputeBalanceRule:
    def test_returns_zero_for_user_without_transactions(self, client_user, db):
        assert _balance(client_user) == 0

    def test_sums_in_and_subtracts_out(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=10_000, source="checkout",
            description="Compra inicial", idempotency_key="seed-1",
        )
        credit_ledger.credit(
            client_user, amount=5_000, source="checkout",
            description="Compra extra", idempotency_key="seed-2",
        )
        credit_ledger.debit(
            client_user, amount=3_000, source="client_order",
            description="Débito ORD-1", idempotency_key="debit-1",
        )
        db.session.flush()
        assert _balance(client_user) == 12_000

    def test_db_check_constraint_blocks_legacy_type(self, client_user, db):
        """Defesa primária: CHECK ck_credit_transactions_type no DDL
        recusa qualquer INSERT com type fora de {'in','out'}, inclusive
        os legados ('credit'/'debit')."""
        from sqlalchemy.exc import IntegrityError

        tx = CreditTransaction(
            user_id=client_user.id,
            company_id=client_user.company_id,
            type="credit",  # legacy
            source="manual",
            amount=10_000,
            description="Insert cru — legacy",
        )
        db.session.add(tx)
        with pytest.raises(IntegrityError):
            db.session.flush()
        db.session.rollback()

    def test_compute_balance_raises_on_unknown_type_at_runtime(
        self, client_user, db, monkeypatch
    ):
        """Defesa secundária: se a CHECK do banco for desabilitada/burlar
        (dev mode, migration ainda não aplicada, dump restaurado), a
        soma em runtime deve estourar LedgerCorruption em vez de
        silenciar."""

        # Forja o resultado da query interna do compute_balance sem
        # passar pela camada de constraint do banco.
        class _FakeResult:
            def fetchall(self):
                return [("credit", 10_000), ("in", 5_000)]

        original_execute = credit_ledger.db.session.execute

        def fake_execute(stmt, params=None):
            sql = str(stmt)
            if "SELECT type, amount FROM credit_transactions" in sql:
                return _FakeResult()
            return original_execute(stmt, params)

        monkeypatch.setattr(credit_ledger.db.session, "execute", fake_execute)
        with pytest.raises(credit_ledger.LedgerCorruption):
            credit_ledger.compute_balance(client_user.id)

    def test_compute_totals_returns_three_numbers(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=20_000, source="checkout",
            description="In", idempotency_key="t-in",
        )
        credit_ledger.debit(
            client_user, amount=7_500, source="client_order",
            description="Out", idempotency_key="t-out",
        )
        db.session.flush()
        totals = credit_ledger.compute_totals(client_user.id)
        assert totals == {"credits_in": 20_000, "credits_out": 7_500, "balance": 12_500}


# ---------------------------------------------------------------------------
# 2. Gate de débito + 5. Invariante de não-negatividade
# ---------------------------------------------------------------------------


class TestDebitGate:
    def test_blocks_debit_above_balance(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=5_000, source="checkout",
            description="Aporte", idempotency_key="ap-1",
        )
        with pytest.raises(credit_ledger.InsufficientBalance) as exc:
            credit_ledger.debit(
                client_user, amount=5_001, source="client_order",
                description="Tentativa over", idempotency_key="over-1",
            )
        assert exc.value.available == 5_000
        assert exc.value.required == 5_001
        # Nenhuma linha inserida — saldo intacto
        assert _balance(client_user) == 5_000

    def test_two_sequential_debits_respect_gate(self, client_user, db):
        """Em SQLite a "concorrência" é sequencial. O ponto deste teste é
        garantir que o gate é avaliado sob o saldo corrente, não cached —
        ou seja, o segundo débito vê o estado pós-primeiro."""
        credit_ledger.credit(
            client_user, amount=10_000, source="checkout",
            description="Aporte", idempotency_key="seq-aporte",
        )
        credit_ledger.debit(
            client_user, amount=6_000, source="client_order",
            description="Primeiro", idempotency_key="seq-1",
        )
        with pytest.raises(credit_ledger.InsufficientBalance):
            credit_ledger.debit(
                client_user, amount=5_000, source="client_order",
                description="Segundo > saldo restante",
                idempotency_key="seq-2",
            )
        assert _balance(client_user) == 4_000

    def test_invariant_catches_negative_balance(self, client_user, db, monkeypatch):
        """Se algum bug nosso fizer o gate passar errado, a invariante
        pós-INSERT pega o saldo negativo e estoura LedgerCorruption."""
        # Faz o gate "passar" forçando compute_balance pré-INSERT a mentir
        # (cenário só reproduzível por bug interno; o teste valida a
        # segunda linha de defesa).
        original = credit_ledger.compute_balance
        calls = {"n": 0}

        def fake(user_id: int, kind: str = credit_ledger.KIND_COMMON) -> int:
            calls["n"] += 1
            # Primeira chamada (gate): mente que tem saldo infinito.
            # Segunda chamada (invariante pós-INSERT): retorna o real.
            return 10_000_000 if calls["n"] == 1 else original(user_id, kind=kind)

        monkeypatch.setattr(credit_ledger, "compute_balance", fake)
        with pytest.raises(credit_ledger.LedgerCorruption):
            credit_ledger.debit(
                client_user, amount=1_000, source="client_order",
                description="Sob gate adulterado",
                idempotency_key="invariant-1",
            )


# ---------------------------------------------------------------------------
# 3. Replay seguro por idempotency_key
# ---------------------------------------------------------------------------


class TestIdempotency:
    def test_same_key_returns_original_on_credit(self, client_user, db):
        tx1 = credit_ledger.credit(
            client_user, amount=8_000, source="checkout",
            description="Compra X", idempotency_key="idem-credit-1",
        )
        tx2 = credit_ledger.credit(
            client_user, amount=8_000, source="checkout",
            description="Compra X", idempotency_key="idem-credit-1",
        )
        assert tx1.id == tx2.id
        # Só uma linha no DB
        rows = CreditTransaction.query.filter_by(user_id=client_user.id).all()
        assert len(rows) == 1
        assert _balance(client_user) == 8_000

    def test_same_key_returns_original_on_debit(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=10_000, source="checkout",
            description="Aporte", idempotency_key="idem-aporte",
        )
        tx1 = credit_ledger.debit(
            client_user, amount=3_000, source="client_order",
            description="Pedido Y", idempotency_key="idem-debit-1",
        )
        tx2 = credit_ledger.debit(
            client_user, amount=3_000, source="client_order",
            description="Pedido Y", idempotency_key="idem-debit-1",
        )
        assert tx1.id == tx2.id
        assert _balance(client_user) == 7_000

    def test_same_key_with_mismatched_payload_raises(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=5_000, source="checkout",
            description="Original", idempotency_key="strict-1",
        )
        # Caller tentando reusar a chave com amount diferente — bug
        with pytest.raises(credit_ledger.IdempotentReplay):
            credit_ledger.credit(
                client_user, amount=9_999, source="checkout",
                description="Original", idempotency_key="strict-1",
            )

    def test_no_key_means_no_dedup(self, client_user, db):
        # Sem chave, é responsabilidade do caller. UNIQUE de
        # (user_id, source, description) ainda pega description igual.
        credit_ledger.credit(
            client_user, amount=1_000, source="manual_no_key",
            description="Variação A",
        )
        credit_ledger.credit(
            client_user, amount=1_000, source="manual_no_key",
            description="Variação B",  # description diferente: passa
        )
        assert _balance(client_user) == 2_000


# ---------------------------------------------------------------------------
# 4. Refund / estorno
# ---------------------------------------------------------------------------


class TestRefund:
    def test_refund_inverts_an_out_into_in(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=10_000, source="checkout",
            description="Aporte", idempotency_key="ref-aporte",
        )
        debit = credit_ledger.debit(
            client_user, amount=4_000, source="client_order",
            description="Débito ORD-X", idempotency_key="ref-debit",
        )
        assert _balance(client_user) == 6_000
        credit_ledger.refund(
            debit, source="client_order_refund",
            description="Estorno ORD-X",
            idempotency_key=f"refund-{debit.id}",
        )
        assert _balance(client_user) == 10_000

    def test_refund_is_idempotent_with_key(self, client_user, db):
        credit_ledger.credit(
            client_user, amount=10_000, source="checkout",
            description="Aporte", idempotency_key="ref2-aporte",
        )
        debit = credit_ledger.debit(
            client_user, amount=2_000, source="client_order",
            description="Débito ORD-Y", idempotency_key="ref2-debit",
        )
        credit_ledger.refund(
            debit, source="client_order_refund",
            description="Estorno ORD-Y",
            idempotency_key="ref2-refund",
        )
        credit_ledger.refund(
            debit, source="client_order_refund",
            description="Estorno ORD-Y",
            idempotency_key="ref2-refund",
        )
        # Crédito + débito + UM refund, não dois
        assert (
            CreditTransaction.query
            .filter_by(user_id=client_user.id, source="client_order_refund")
            .count() == 1
        )
        assert _balance(client_user) == 10_000

    def test_gateway_refund_allows_negative_balance(self, client_user, db):
        # Cliente compra crédito, gasta tudo, depois Pagar.me reembolsa.
        # O estorno do gateway tem que conseguir baixar o saldo mesmo
        # ficando negativo — esse negativo é dívida real do cliente.
        purchase = credit_ledger.credit(
            client_user, amount=5_000, source="checkout",
            description="Compra X", idempotency_key="neg-purchase",
        )
        credit_ledger.debit(
            client_user, amount=5_000, source="client_order",
            description="Gasto", idempotency_key="neg-gasto",
        )
        assert _balance(client_user) == 0
        # `refund` de um type='in' faz type='out' (estorno de compra) —
        # vai zerar a compra mas saldo fica em -5_000 porque já gastou.
        credit_ledger.refund(
            purchase, source="checkout_refund",
            description="Estorno gateway",
            idempotency_key="neg-refund",
        )
        assert _balance(client_user) == -5_000


# ---------------------------------------------------------------------------
# 6. Tipos textuais — gate de aplicação
# ---------------------------------------------------------------------------


class TestTypeWhitelist:
    def test_credit_with_negative_amount_raises(self, client_user, db):
        with pytest.raises(credit_ledger.LedgerError):
            credit_ledger.credit(
                client_user, amount=-100, source="x", description="neg",
            )

    def test_credit_with_zero_amount_raises(self, client_user, db):
        with pytest.raises(credit_ledger.LedgerError):
            credit_ledger.credit(
                client_user, amount=0, source="x", description="zero",
            )

    def test_credit_with_empty_description_raises(self, client_user, db):
        with pytest.raises(credit_ledger.LedgerError):
            credit_ledger.credit(
                client_user, amount=100, source="x", description="   ",
            )

    def test_description_max_length(self, client_user, db):
        with pytest.raises(credit_ledger.LedgerError):
            credit_ledger.credit(
                client_user, amount=100, source="x",
                description="a" * 256,
            )


# ---------------------------------------------------------------------------
# Integração com get_balance — mesma fonte de verdade
# ---------------------------------------------------------------------------


class TestFinancialServiceParity:
    def test_get_balance_uses_credit_ledger_totals(self, client_user, db):
        from app.services.financial_service import get_balance

        credit_ledger.credit(
            client_user, amount=20_000, source="checkout",
            description="Recarga", idempotency_key="parity-in",
        )
        credit_ledger.debit(
            client_user, amount=7_500, source="client_order",
            description="Pedido", idempotency_key="parity-out",
        )
        db.session.flush()
        snapshot = get_balance(client_user)
        assert snapshot["credits_total_cents"] == 20_000
        assert snapshot["credits_used_cents"] == 7_500
        assert snapshot["credits_available_cents"] == 12_500
        # E o nosso compute_balance bate exatamente com isso
        assert credit_ledger.compute_balance(client_user.id) == 12_500
