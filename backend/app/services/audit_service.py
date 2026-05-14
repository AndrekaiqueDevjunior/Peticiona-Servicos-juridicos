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
    status: str = "success",
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    from flask import request
    
    # Extrai IP e User-Agent da request se não fornecidos
    if ip_address is None and request:
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else request.remote_addr
    
    if user_agent is None and request:
        user_agent = request.headers.get("User-Agent", "")
    
    # Sanitiza metadata para remover dados sensíveis
    sanitized_metadata = _sanitize_metadata(metadata or {})
    
    log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        user_id=getattr(user, "id", None),
        actor_role=getattr(user, "role", None),
        company_id=company_id if company_id is not None else getattr(user, "company_id", None),
        metadata_json=sanitized_metadata,
        status=status,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.session.add(log)
    return log


def _sanitize_metadata(metadata: dict) -> dict:
    """Remove dados sensíveis do metadata de auditoria"""
    if not isinstance(metadata, dict):
        return metadata
    
    sanitized = dict(metadata)
    
    # Lista de chaves sensíveis que devem ser removidas ou mascaradas
    sensitive_keys = [
        "password", "password_hash", "token", "secret", "key",
        "credit_card", "card_number", "cvv", "exp_month", "exp_year",
        "ssn", "cpf", "cnpj", "authorization", "bearer"
    ]
    
    for key in list(sanitized.keys()):
        key_lower = key.lower()
        if any(sensitive in key_lower for sensitive in sensitive_keys):
            if key_lower in ["password", "password_hash", "secret", "key"]:
                del sanitized[key]
            else:
                # Mascarar dados parcialmente
                value = str(sanitized[key])
                if len(value) > 8:
                    sanitized[key] = value[:4] + "*" * (len(value) - 8) + value[-4:]
                else:
                    sanitized[key] = "*" * len(value)
    
    return sanitized
