"""Helpers de autenticação para os testes.

Estes utilitários assumem que existe um app context ativo (fornecido pela
fixture `app` do conftest), porque dependem de `current_app` para ler o
JWT_SECRET.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app

from app.core.jwt import create_access_token
from app.models import User


def auth_header(user: User | int) -> dict[str, str]:
    """Retorna o header `Authorization: Bearer <jwt>` para um usuário."""
    uid = user.id if isinstance(user, User) else int(user)
    token = create_access_token(user_id=uid)
    return {"Authorization": f"Bearer {token}"}


def expired_token(user: User | int) -> str:
    """Gera um JWT já expirado para testar fluxo de sessão vencida."""
    uid = user.id if isinstance(user, User) else int(user)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uid),
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
    }
    secret = current_app.config.get("JWT_SECRET") or current_app.config["SECRET_KEY"]
    return jwt.encode(payload, secret, algorithm="HS256")


def malformed_token() -> str:
    """JWT assinado com segredo errado — deve ser rejeitado."""
    payload = {"sub": "1"}
    return jwt.encode(payload, "wrong-secret", algorithm="HS256")
