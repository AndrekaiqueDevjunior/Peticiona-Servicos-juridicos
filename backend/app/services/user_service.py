from __future__ import annotations

import hashlib
import logging

from app.core.errors import ConflictError, ValidationError
from app.core.extensions import db
from app.core.security import hash_password, verify_password
from app.models import Document, TermsAcceptance, User
from app.models.base import utcnow
from app.services.audit_service import log_action
from app.services.financial_service import get_balance
from app.services.serializers import serialize_document, serialize_user

TERMS_VERSION = "1.0.0"
TERMS_TEXT_HASH = hashlib.sha256(
    b"peticiona-termos-de-uso-politica-cancelamento-v1.0.0"
).hexdigest()
logger = logging.getLogger(__name__)


def get_profile(user) -> dict:
    return serialize_user(user)


def update_profile(user, payload: dict) -> dict:
    full_name = payload.get("full_name")
    oab_number = payload.get("oab_number")
    email = payload.get("email")
    phone = payload.get("phone")

    if full_name is not None:
        cleaned = full_name.strip()
        if not cleaned:
            raise ValidationError("Nome completo não pode ficar vazio.")
        user.full_name = cleaned

    if oab_number is not None:
        user.oab_number = oab_number.strip() or None

    if email is not None:
        cleaned = email.strip().lower()
        if not cleaned:
            raise ValidationError("E-mail não pode ficar vazio.")
        existing = User.query.filter(User.email == cleaned, User.id != user.id).first()
        if existing is not None:
            raise ConflictError("E-mail já está em uso por outro usuário.")
        user.email = cleaned

    if phone is not None:
        cleaned = phone.strip()
        if not cleaned:
            raise ValidationError("Telefone não pode ficar vazio.")
        user.phone = cleaned

    for field in (
        "zip_code",
        "street",
        "street_number",
        "address_complement",
        "neighborhood",
        "city",
        "state",
    ):
        value = payload.get(field)
        if value is not None:
            cleaned = str(value).strip()
            if field == "state":
                cleaned = cleaned.upper()[:2]
            setattr(user, field, cleaned or None)

    log_action(
        action="user.updated_profile",
        entity_type="user",
        entity_id=user.id,
        user=user,
        metadata={
            "full_name": user.full_name,
            "oab_number": user.oab_number,
            "email": user.email,
            "phone": user.phone,
        },
    )
    db.session.commit()
    return serialize_user(user)


def change_my_password(user, payload: dict) -> dict:
    current = str((payload or {}).get("current_password") or "")
    new_password = str((payload or {}).get("new_password") or "")

    if not current:
        raise ValidationError("Informe a senha atual.")
    if not new_password:
        raise ValidationError("Informe a nova senha.")
    if current == new_password:
        raise ValidationError("Nova senha deve ser diferente da atual.")

    if not verify_password(current, user.password_hash):
        raise ValidationError("Senha atual incorreta.")

    # Política unificada — antes este caminho só checava `len >= 8`,
    # divergente do register e do reset. Agora os 3 caminhos passam
    # pela mesma função em app.core.password.
    from app.core.password import validate_password_strength
    validate_password_strength(new_password, email=user.email)

    user.password_hash = hash_password(new_password)
    log_action(
        action="user.changed_password",
        entity_type="user",
        entity_id=user.id,
        user=user,
    )
    db.session.commit()
    return {"ok": True}


def get_balance_snapshot(user) -> dict:
    try:
        from app.services.checkout_service import recover_paid_checkout_credits

        recover_paid_checkout_credits(user)
    except Exception:
        db.session.rollback()
        logger.exception("balance_recover_paid_checkout_credits_failed user_id=%s", user.id)
    return get_balance(user)


def get_documents(user) -> dict:
    docs = (
        Document.query.filter_by(user_id=user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return {"documents": [serialize_document(doc) for doc in docs]}


def get_terms_acceptance(user) -> dict:
    acceptance = (
        TermsAcceptance.query.filter_by(
            user_id=user.id,
            version=TERMS_VERSION,
            text_hash=TERMS_TEXT_HASH,
        )
        .order_by(TermsAcceptance.accepted_at.desc())
        .first()
    )
    return {
        "accepted": acceptance is not None,
        "current_version": TERMS_VERSION,
        "text_hash": TERMS_TEXT_HASH,
        "acceptance": _serialize_terms_acceptance(acceptance) if acceptance else None,
    }


def accept_terms(user, *, ip_address: str | None = None, user_agent: str | None = None) -> dict:
    existing = (
        TermsAcceptance.query.filter_by(
            user_id=user.id,
            version=TERMS_VERSION,
            text_hash=TERMS_TEXT_HASH,
        )
        .order_by(TermsAcceptance.accepted_at.desc())
        .first()
    )
    if existing is not None:
        return {
            "accepted": True,
            "current_version": TERMS_VERSION,
            "text_hash": TERMS_TEXT_HASH,
            "acceptance": _serialize_terms_acceptance(existing),
        }

    acceptance = TermsAcceptance(
        user_id=user.id,
        company_id=user.company_id,
        version=TERMS_VERSION,
        text_hash=TERMS_TEXT_HASH,
        accepted_at=utcnow(),
        ip_address=(ip_address or "")[:64] or None,
        user_agent=(user_agent or "")[:255] or None,
    )
    db.session.add(acceptance)
    db.session.flush()
    log_action(
        action="terms.accepted",
        entity_type="terms_acceptance",
        entity_id=acceptance.id,
        user=user,
        metadata={"version": TERMS_VERSION, "text_hash": TERMS_TEXT_HASH},
    )
    db.session.commit()
    return {
        "accepted": True,
        "current_version": TERMS_VERSION,
        "text_hash": TERMS_TEXT_HASH,
        "acceptance": _serialize_terms_acceptance(acceptance),
    }


def _serialize_terms_acceptance(acceptance: TermsAcceptance) -> dict:
    return {
        "id": acceptance.id,
        "version": acceptance.version,
        "text_hash": acceptance.text_hash,
        "accepted_at": acceptance.accepted_at.isoformat(),
        "ip_address": acceptance.ip_address,
    }
