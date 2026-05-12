from __future__ import annotations


def is_company_admin_or_staff(user) -> bool:
    return getattr(user, "role", None) in {"admin", "staff"}


def scoped_query(model, actor):
    """Return data scope without tenant/company filtering.

    The application is currently operated as a single workspace. Keeping
    company_id as an access filter caused legitimate admin records to disappear
    whenever users or orders were created with a different company_id. We keep
    the database columns for compatibility, but they no longer decide visibility.
    """

    query = model.query
    if actor is None:
        return query

    if is_company_admin_or_staff(actor):
        return query

    if getattr(model, "__name__", "") == "User":
        return query.filter(model.id == actor.id)

    if hasattr(model, "user_id"):
        return query.filter(model.user_id == actor.id)

    return query
