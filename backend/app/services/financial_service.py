from __future__ import annotations

from app.domain.permissions import scoped_query
from app.models import CreditTransaction
from app.services.serializers import format_brl_from_cents


def get_balance(user) -> dict:
    transactions = (
        scoped_query(CreditTransaction, user)
        .filter(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .all()
    )

    credit_types = {"in", "credit"}
    debit_types = {"out", "debit"}
    credits_total = sum(item.amount for item in transactions if item.type in credit_types)
    credits_used = sum(item.amount for item in transactions if item.type in debit_types)
    credits_available = credits_total - credits_used

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
                "type": "in" if item.type in credit_types else "out",
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
