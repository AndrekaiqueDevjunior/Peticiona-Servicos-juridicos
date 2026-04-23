from __future__ import annotations

from app.core.errors import AuthError, ConflictError, ValidationError
from app.core.extensions import db
from app.core.jwt import create_access_token
from app.core.security import hash_password, verify_password
from app.models import Company, Plan, Subscription, User
from app.models.users import unique_company_slug
from app.services.audit_service import log_action
from app.services.serializers import serialize_user


def _default_plan() -> Plan:
    plan = Plan.query.filter_by(code="starter").first()
    if plan is None:
        raise ValidationError("Plano inicial não encontrado.")
    return plan


def _create_company_for_user(full_name: str) -> Company:
    existing_slugs = {value for (value,) in db.session.query(Company.slug).all()}
    slug = unique_company_slug(full_name, existing=existing_slugs)
    company = Company(name=full_name, slug=slug)
    db.session.add(company)
    db.session.flush()
    return company


def register_user(payload: dict) -> dict:
    full_name = (payload.get("full_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    oab_number = (payload.get("oab_number") or "").strip() or None
    password = payload.get("password") or ""
    confirm_password = payload.get("confirm_password") or ""

    if not full_name:
        raise ValidationError("Nome completo é obrigatório.")
    if not email:
        raise ValidationError("E-mail é obrigatório.")
    if len(password) < 8:
        raise ValidationError("Senha deve ter pelo menos 8 caracteres.")
    if password != confirm_password:
        raise ValidationError("Confirmação de senha não confere.")
    if User.query.filter_by(email=email).first():
        raise ConflictError("Já existe uma conta com este e-mail.")

    company = _create_company_for_user(full_name)
    plan = _default_plan()

    user = User(
        full_name=full_name,
        email=email,
        oab_number=oab_number,
        password_hash=hash_password(password),
        role="client",
        company_id=company.id,
        active_plan_id=plan.id,
    )
    db.session.add(user)
    db.session.flush()

    db.session.add(
        Subscription(
            user_id=user.id,
            company_id=company.id,
            plan_id=plan.id,
            status="active",
        )
    )
    log_action(
        action="user.registered",
        entity_type="user",
        entity_id=user.id,
        user=user,
        company_id=company.id,
        metadata={"email": user.email},
    )
    db.session.commit()

    return {"token": create_access_token(user_id=user.id), "user": serialize_user(user)}


def login_user(payload: dict) -> dict:
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        raise ValidationError("Informe e-mail e senha.")

    user = User.query.filter_by(email=email).first()
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Credenciais inválidas.")
    if not user.is_active:
        raise AuthError("Conta inativa.")

    log_action(
        action="user.logged_in",
        entity_type="user",
        entity_id=user.id,
        user=user,
        metadata={"email": user.email},
    )
    db.session.commit()
    return {"token": create_access_token(user_id=user.id), "user": serialize_user(user)}
