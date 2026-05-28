from __future__ import annotations

from app.domain.permissions import scoped_query
from app.models import CreditTransaction
from app.services.credit_ledger import (
    KIND_COMMON,
    KIND_LEGACY_CENTS,
    compute_balances,
    compute_totals,
)


def get_balance(user) -> dict:
    """Snapshot do saldo (em unidades de crédito) + extrato."""
    transactions = (
        scoped_query(CreditTransaction, user)
        .filter(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .all()
    )

    balances = compute_balances(user.id)
    totals_common = compute_totals(user.id, kind=KIND_COMMON)

    credits_available = balances[KIND_COMMON]
    credits_total = totals_common["credits_in"]
    credits_used = totals_common["credits_out"]

    return {
        "credits_available": credits_available,
        "credits_available_cents": credits_available,
        "credits_available_brl": f"{credits_available} crédito(s)",
        "credits_total": credits_total,
        "credits_total_cents": credits_total,
        "credits_total_brl": f"{credits_total} crédito(s)",
        "credits_used": credits_used,
        "credits_used_cents": credits_used,
        "credits_used_brl": f"{credits_used} crédito(s)",
        "balances": {
            "common": credits_available,
        },
        "totals_by_kind": {
            "common": totals_common,
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
    return f"R$ {amount_cents / 100:.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
