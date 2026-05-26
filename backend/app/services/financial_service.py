from __future__ import annotations

from app.domain.permissions import scoped_query
from app.models import CreditTransaction
from app.services.credit_ledger import (
    KIND_COMMON,
    KIND_LEGACY_CENTS,
    KIND_PETICAO_EXPRESS,
    KIND_RECURSO_EXPRESS,
    compute_balances,
    compute_totals,
)


def get_balance(user) -> dict:
    """Snapshot do saldo (em unidades de crédito) + extrato.

    O sistema novo trabalha em UNIDADES — 1 crédito comum, 1 crédito de
    Petição Express, 1 crédito de Recurso Express. Saldos por kind NÃO
    se misturam. Rows com kind='legacy_cents' (saldo histórico em centavos)
    são preservadas no extrato para auditoria, mas NÃO entram nos saldos.
    """
    transactions = (
        scoped_query(CreditTransaction, user)
        .filter(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .all()
    )

    balances = compute_balances(user.id)
    totals_common = compute_totals(user.id, kind=KIND_COMMON)
    totals_pet_exp = compute_totals(user.id, kind=KIND_PETICAO_EXPRESS)
    totals_rec_exp = compute_totals(user.id, kind=KIND_RECURSO_EXPRESS)

    # Compat: saldo "principal" exibido nos lugares que ainda esperam um
    # número único = saldo de créditos comuns (1 crédito = 1 serviço).
    credits_available = balances[KIND_COMMON]
    credits_total = totals_common["credits_in"]
    credits_used = totals_common["credits_out"]

    return {
        # Saldo principal (créditos comuns) — campos legados mantidos para
        # callers antigos. Agora representa UNIDADES de crédito, não centavos.
        "credits_available": credits_available,
        "credits_available_cents": credits_available,  # legacy field name
        "credits_available_brl": f"{credits_available} crédito(s)",
        "credits_total": credits_total,
        "credits_total_cents": credits_total,
        "credits_total_brl": f"{credits_total} crédito(s)",
        "credits_used": credits_used,
        "credits_used_cents": credits_used,
        "credits_used_brl": f"{credits_used} crédito(s)",
        # Saldos segregados por kind — fonte de verdade do novo sistema.
        "balances": {
            "common": balances[KIND_COMMON],
            "peticao_express": balances[KIND_PETICAO_EXPRESS],
            "recurso_express": balances[KIND_RECURSO_EXPRESS],
        },
        "totals_by_kind": {
            "common": totals_common,
            "peticao_express": totals_pet_exp,
            "recurso_express": totals_rec_exp,
        },
        "movements": [
            {
                "type": item.type,
                "amount": item.amount,
                "amount_cents": item.amount,
                "amount_brl": f"{item.amount} crédito(s)" if getattr(item, "kind", KIND_COMMON) != KIND_LEGACY_CENTS else _legacy_cents_label(item.amount),
                "kind": getattr(item, "kind", KIND_COMMON) or KIND_COMMON,
                "description": item.description,
                "source": item.source,
                "date": item.created_at.isoformat(),
            }
            for item in transactions
        ],
    }


def _legacy_cents_label(amount_cents: int) -> str:
    """Formata valor em centavos para exibição (apenas rows legacy)."""
    return f"R$ {amount_cents / 100:.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
