from __future__ import annotations

from app.models import Plan
from app.services.serializers import serialize_plan


def get_home_content() -> dict:
    return {
        "hero": {
            "title": "Peticiona",
            "subtitle": "Fluxo jurídico com regras de negócio no backend e operação preparada para escalar.",
        },
        "highlights": [
            "Autenticação centralizada",
            "Permissões por papel",
            "Isolamento por empresa",
            "Auditoria dos eventos sensíveis",
        ],
    }


def get_plans_catalog() -> dict:
    plans = Plan.query.filter_by(is_active=True).order_by(Plan.monthly_price_cents.asc()).all()
    return {"plans": [serialize_plan(plan) for plan in plans]}
