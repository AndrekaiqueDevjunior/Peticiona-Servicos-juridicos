from __future__ import annotations

from app.core.errors import ValidationError
from app.core.extensions import db
from app.services.audit_service import log_action
from app.services.financial_service import get_balance
from app.services.serializers import serialize_user


def get_profile(user) -> dict:
    return serialize_user(user)


def update_profile(user, payload: dict) -> dict:
    full_name = payload.get("full_name")
    oab_number = payload.get("oab_number")

    if full_name is not None:
        cleaned = full_name.strip()
        if not cleaned:
            raise ValidationError("Nome completo não pode ficar vazio.")
        user.full_name = cleaned

    if oab_number is not None:
        user.oab_number = oab_number.strip() or None

    log_action(
        action="user.updated_profile",
        entity_type="user",
        entity_id=user.id,
        user=user,
        metadata={"full_name": user.full_name, "oab_number": user.oab_number},
    )
    db.session.commit()
    return serialize_user(user)


def get_balance_snapshot(user) -> dict:
    return get_balance(user)
