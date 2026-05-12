from __future__ import annotations

from functools import wraps

from flask import g, request

from app.core.errors import AuthError, PermissionDenied
from app.core.extensions import db
from app.core.jwt import decode_access_token, extract_subject
from app.models import User


def current_actor(optional: bool = False):
    if hasattr(g, "current_user"):
        return g.current_user

    header = request.headers.get("Authorization", "").strip()
    if not header:
        if optional:
            g.current_user = None
            return None
        raise AuthError("Token de autenticação ausente.")

    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthError("Cabeçalho Authorization inválido.")

    payload = decode_access_token(token)
    user_id = extract_subject(payload)
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        raise AuthError("Usuário autenticado não encontrado.")

    g.current_user = user
    return user


def auth_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        current_actor()
        return func(*args, **kwargs)

    return wrapper


def roles_required(*roles: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            actor = current_actor()
            if actor.role not in roles:
                raise PermissionDenied("Usuário não autorizado para esta operação.")
            return func(*args, **kwargs)

        return wrapper

    return decorator
