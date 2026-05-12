from __future__ import annotations

from itsdangerous import BadSignature, BadTimeSignature, URLSafeTimedSerializer
from flask import current_app

from app.core.errors import AppError, ValidationError
from app.core.extensions import db
from app.core.security import hash_password
from app.models import User
from app.services.email_service import send_email


class EmailDeliveryError(AppError):
    status_code = 503


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="password-reset")


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_email(email: str) -> str:
    normalized = _normalize_email(email)
    if not normalized:
        raise ValidationError("Informe o e-mail cadastrado.")
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise ValidationError("Informe um e-mail válido.")
    return normalized


def _validate_password(password: str) -> None:
    checks = [
        (len(password) >= 8, "A senha deve ter no mínimo 8 caracteres."),
        (any(c.isupper() for c in password), "A senha precisa ter ao menos 1 letra maiúscula."),
        (any(c.islower() for c in password), "A senha precisa ter ao menos 1 letra minúscula."),
        (any(c.isdigit() for c in password), "A senha precisa ter ao menos 1 número."),
        (
            any(not c.isalnum() for c in password),
            "A senha precisa ter ao menos 1 símbolo.",
        ),
    ]

    for ok, message in checks:
        if not ok:
            raise ValidationError(message)


def _password_fingerprint(user: User) -> str:
    return user.password_hash[-12:]


def _build_reset_token(user: User) -> str:
    return _serializer().dumps(
        {
            "user_id": user.id,
            "email": user.email,
            "pwd": _password_fingerprint(user),
        }
    )


def _frontend_base_url() -> str:
    configured = (current_app.config.get("FRONTEND_URL") or "").strip().rstrip("/")
    if configured:
        return configured

    origins = current_app.config.get("CORS_ALLOWED_ORIGINS") or []
    for origin in origins:
        normalized = origin.strip().rstrip("/")
        if normalized and "api." not in normalized:
            return normalized

    return "http://localhost:8080"


def _reset_link(token: str) -> str:
    return f"{_frontend_base_url()}/reset-password?token={token}"


def _email_body(user: User, token: str) -> str:
    link = _reset_link(token)
    return "\n".join(
        [
            f"Olá, {user.full_name}.",
            "",
            "Recebemos uma solicitação para redefinir a senha da sua conta na Peticiona.",
            "Se foi você, use o link abaixo para criar uma nova senha:",
            link,
            "",
            "Este link expira em 1 hora.",
            "Se você não pediu a redefinição, pode ignorar esta mensagem com segurança.",
        ]
    )


def request_password_reset(email: str) -> dict:
    normalized = _validate_email(email)
    user = User.query.filter(db.func.lower(User.email) == normalized).first()

    if not user or not user.is_active:
        return {"message": "Se o e-mail estiver cadastrado, enviaremos as instruções."}

    token = _build_reset_token(user)
    delivered = send_email(
        to=user.email,
        subject="Redefinição de senha - Peticiona",
        body=_email_body(user, token),
    )
    if not delivered:
        raise EmailDeliveryError(
            "Não foi possível enviar o e-mail de redefinição agora. Verifique a configuração do SendGrid ou SMTP."
        )

    return {"message": "Se o e-mail estiver cadastrado, enviaremos as instruções."}


def _load_token_payload(token: str) -> dict:
    if not token or not token.strip():
        raise ValidationError("Token de redefinição inválido.")

    max_age = int(current_app.config.get("PASSWORD_RESET_TOKEN_TTL_SECONDS", 3600))
    try:
        return _serializer().loads(token.strip(), max_age=max_age)
    except (BadTimeSignature, BadSignature):
        raise ValidationError("O link de redefinição é inválido ou expirou.") from None


def confirm_password_reset(token: str, password: str) -> dict:
    _validate_password(password)
    payload = _load_token_payload(token)

    user_id = payload.get("user_id")
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        raise ValidationError("O link de redefinição é inválido ou expirou.")

    if payload.get("email") != user.email or payload.get("pwd") != _password_fingerprint(user):
        raise ValidationError("O link de redefinição é inválido ou expirou.")

    user.password_hash = hash_password(password)
    db.session.commit()
    return {"message": "Senha redefinida com sucesso."}
