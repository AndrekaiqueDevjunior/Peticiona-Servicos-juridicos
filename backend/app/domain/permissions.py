from __future__ import annotations

def is_company_admin_or_staff(user) -> bool:
    return getattr(user, "role", None) in {"admin", "staff"}


def scoped_query(model, actor):
    query = model.query
    if actor is None:
        return query

    if hasattr(model, "company_id") and actor.company_id is not None:
        query = query.filter(model.company_id == actor.company_id)

    if is_company_admin_or_staff(actor):
        if actor.company_id is None and hasattr(model, "user_id"):
            return query.filter(model.user_id == actor.id)
        return query

    if hasattr(model, "user_id"):
        return query.filter(model.user_id == actor.id)

    return query
