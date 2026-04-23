from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app

from app.core.errors import AuthError


def _jwt_secret() -> str:
    return current_app.config.get("JWT_SECRET") or current_app.config["SECRET_KEY"]


def create_access_token(*, user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(seconds=current_app.config["JWT_EXPIRATION"]),
    }
    return jwt.encode(
        payload,
        _jwt_secret(),
        algorithm="HS256",
    )


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            _jwt_secret(),
            algorithms=["HS256"],
            options={"verify_sub": False},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Sessão expirada. Faça login novamente.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("Token de autenticação inválido.") from exc


def extract_subject(payload: dict) -> int:
    subject = payload.get("sub")
    if subject in (None, ""):
        raise AuthError("Token sem usuário associado.")
    try:
        return int(subject)
    except (TypeError, ValueError) as exc:
        raise AuthError("Identidade inválida no token.") from exc
