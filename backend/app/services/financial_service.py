from __future__ import annotations

from app.domain.permissions import scoped_query
from app.models import CreditTransaction
from app.services.credit_ledger import compute_totals
from app.services.serializers import format_brl_from_cents


def get_balance(user) -> dict:
    """Snapshot do saldo + extrato para a UI do cliente.

    Os totais (credits_total/used/available) vêm de
    ``credit_ledger.compute_totals``, que é a soma autoritativa usada
    também pelo gate de débito. Antes este arquivo tinha sua própria
    soma com whitelist mais permissivo (`credit`/`debit` além de
    `in`/`out`) — divergente do gate. Agora as duas leituras
    compartilham a mesma regra estrita.
    """
    transactions = (
        scoped_query(CreditTransaction, user)
        .filter(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .all()
    )

    totals = compute_totals(user.id)
    credits_total = totals["credits_in"]
    credits_used = totals["credits_out"]
    credits_available = totals["balance"]

    return {
        "credits_available": credits_available,
        "credits_available_cents": credits_available,
        "credits_available_brl": format_brl_from_cents(credits_available),
        "credits_total": credits_total,
        "credits_total_cents": credits_total,
        "credits_total_brl": format_brl_from_cents(credits_total),
        "credits_used": credits_used,
        "credits_used_cents": credits_used,
        "credits_used_brl": format_brl_from_cents(credits_used),
        "movements": [
            {
                "type": item.type,
                "amount": item.amount,
                "amount_cents": item.amount,
                "amount_brl": format_brl_from_cents(item.amount),
                "description": item.description,
                "source": item.source,
                "date": item.created_at.isoformat(),
            }
            for item in transactions
        ],
    }
