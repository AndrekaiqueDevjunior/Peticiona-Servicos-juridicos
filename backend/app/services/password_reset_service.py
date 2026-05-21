from __future__ import annotations

import logging

from itsdangerous import BadSignature, BadTimeSignature, URLSafeTimedSerializer
from flask import current_app

from app.core.errors import AppError, ValidationError
from app.core.extensions import db
from app.core.security import hash_password
from app.models import User
from app.services.email_service import build_password_reset_html, send_email

logger = logging.getLogger(__name__)


class EmailDeliveryError(AppError):
    status_code = 503


def _email_provider_configured() -> bool:
    """True se algum provider de e-mail (Resend/SendGrid/SMTP) tem credencial.

    Em DEV/test sem provider configurado, o envio vira no-op: logamos o link
    no console pra continuar testando o fluxo, em vez de jogar 503. Em prod
    com provider mas envio falhando (rate limit, DNS, etc.), seguimos com
    erro silencioso pro cliente (resposta genérica 200 — não vazamos
    enumeration), mas logamos como warning.
    """
    cfg = current_app.config
    return any(
        bool((cfg.get(key) or "").strip())
        for key in ("RESEND_API_KEY", "SENDGRID_API_KEY", "SMTP_HOST")
    )


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


# Validação delegada à política única em app.core.password —
# antes este arquivo tinha sua própria lógica, divergente de register_user.
from app.core.password import validate_password_strength as _validate_password_strength


def _validate_password(password: str, *, email: str | None = None) -> None:
    _validate_password_strength(password, email=email)


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
            "Se foi você, acesse o link abaixo para criar uma nova senha:",
            link,
            "",
            "Este link expira em 60 minutos.",
            "Se você não pediu a redefinição, pode ignorar esta mensagem com segurança.",
        ]
    )


def _email_html(user: User, token: str) -> str:
    ttl = int(current_app.config.get("PASSWORD_RESET_TOKEN_TTL_SECONDS", 3600)) // 60
    return build_password_reset_html(
        user_name=user.full_name,
        reset_link=_reset_link(token),
        expires_minutes=ttl,
    )


def request_password_reset(email: str) -> dict:
    """Solicita reset de senha, com proteção contra enumeração.

    Sempre retorna 200 com mensagem genérica, independentemente de o
    e-mail existir ou não, ou de o envio ter falhado. Diferenciar essas
    respostas vazaria quais e-mails estão cadastrados no sistema (timing
    attacks à parte). Em caso de falha real do provider, logamos como
    warning no servidor e o cliente pode tentar novamente.

    Modo DEV (nenhum provider configurado): em vez de jogar 503 e quebrar
    a tela inteira, logamos o link gerado no console — útil pra rodar o
    fluxo de teste localmente sem precisar de Resend/SendGrid/SMTP.
    """
    response = {
        "message": "Se o e-mail estiver cadastrado, enviaremos as instruções."
    }

    try:
        normalized = _validate_email(email)
    except ValidationError:
        raise

    user = User.query.filter(db.func.lower(User.email) == normalized).first()
    if not user or not user.is_active:
        # Não vaza que o e-mail não existe — resposta idêntica ao caso de
        # sucesso. Importante pra não permitir enumeração de usuários.
        return response

    token = _build_reset_token(user)

    if not _email_provider_configured():
        # DEV/teste sem provider: imprime no log e segue. Operador pega
        # o link na saída do backend.
        link = _reset_link(token)
        logger.warning(
            "EMAIL DRY-RUN — nenhum provider configurado. "
            "Link de redefinição para %s: %s",
            user.email,
            link,
        )
        return response

    delivered = send_email(
        to=user.email,
        subject="Redefinição de senha - Peticiona",
        body=_email_body(user, token),
        html=_email_html(user, token),
    )
    if not delivered:
        # Provider configurado mas envio falhou (rate limit, DNS, conta
        # bloqueada…). Logamos pra investigação mas devolvemos a mesma
        # mensagem genérica — não vamos diferenciar pro cliente.
        logger.error(
            "Falha ao enviar e-mail de reset pra user_id=%s (provider configurado).",
            user.id,
        )

    return response


def _load_token_payload(token: str) -> dict:
    if not token or not token.strip():
        raise ValidationError("Token de redefinição inválido.")

    max_age = int(current_app.config.get("PASSWORD_RESET_TOKEN_TTL_SECONDS", 3600))
    try:
        return _serializer().loads(token.strip(), max_age=max_age)
    except (BadTimeSignature, BadSignature):
        raise ValidationError("O link de redefinição é inválido ou expirou.") from None


def confirm_password_reset(token: str, password: str) -> dict:
    # Carregamos o payload primeiro pra extrair o e-mail e passar à
    # validação de senha — bloqueia variantes como "andre@x.com" trocando
    # pra "andre123!" (parte local da senha = parte local do e-mail).
    # Token inválido vira ValidationError genérica antes de qualquer
    # operação no usuário.
    payload = _load_token_payload(token)

    user_id = payload.get("user_id")
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        raise ValidationError("O link de redefinição é inválido ou expirou.")

    if payload.get("email") != user.email or payload.get("pwd") != _password_fingerprint(user):
        raise ValidationError("O link de redefinição é inválido ou expirou.")

    _validate_password(password, email=user.email)

    user.password_hash = hash_password(password)
    # Reset de senha é o bypass legítimo do lockout — quem esqueceu a senha
    # e provou posse do e-mail merece a conta destravada (do contrário
    # ficaria preso até a janela expirar). Sem isso, atacante poderia
    # *forçar lockout* deliberado e fingir que é DoS.
    user.failed_login_attempts = 0
    user.locked_until = None
    db.session.commit()
    return {"message": "Senha redefinida com sucesso."}
