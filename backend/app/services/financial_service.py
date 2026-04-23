from __future__ import annotations

from app.domain.permissions import scoped_query
from app.models import CreditTransaction


def get_balance(user) -> dict:
    transactions = (
        scoped_query(CreditTransaction, user)
        .filter(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .all()
    )

    credits_total = sum(item.amount for item in transactions if item.type == "in")
    credits_used = sum(item.amount for item in transactions if item.type == "out")
    credits_available = credits_total - credits_used

    return {
        "credits_available": credits_available,
        "credits_total": credits_total,
        "credits_used": credits_used,
        "movements": [
            {
                "type": item.type,
                "amount": item.amount,
                "description": item.description,
                "source": item.source,
                "date": item.created_at.isoformat(),
            }
            for item in transactions
        ],
    }
