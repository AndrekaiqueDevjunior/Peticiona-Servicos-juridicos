from __future__ import annotations

from app.core.extensions import db
from app.models import AuditLog


def log_action(
    *,
    action: str,
    entity_type: str,
    entity_id: str | int,
    user=None,
    company_id: int | None = None,
    metadata: dict | None = None,
) -> AuditLog:
    log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        user_id=getattr(user, "id", None),
        company_id=company_id if company_id is not None else getattr(user, "company_id", None),
        metadata_json=metadata or {},
    )
    db.session.add(log)
    return log
