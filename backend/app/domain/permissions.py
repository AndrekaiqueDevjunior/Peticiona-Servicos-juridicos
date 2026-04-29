from __future__ import annotations

from sqlalchemy import or_

def is_company_admin_or_staff(user) -> bool:
    return getattr(user, "role", None) in {"admin", "staff"}


def scoped_query(model, actor):
    query = model.query
    if actor is None:
        return query

    if hasattr(model, "company_id") and actor.company_id is not None:
        # Mantem isolamento por company_id, mas inclui registros legados que ficaram com company_id NULL.
        query = query.filter(or_(model.company_id == actor.company_id, model.company_id.is_(None)))

    if is_company_admin_or_staff(actor):
        # Admin/staff enxergam tudo dentro do escopo da empresa.
        return query

    if hasattr(model, "user_id"):
        return query.filter(model.user_id == actor.id)

    return query
