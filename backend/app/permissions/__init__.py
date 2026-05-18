from __future__ import annotations

from functools import wraps

from flask import g, request

from app.core.errors import AuthError, PermissionDenied
from app.core.extensions import db
from app.core.jwt import decode_access_token, extract_subject
from app.models import User


def current_actor(optional: bool = False):
    # O cache em g.current_user economiza decodificação repetida do JWT
    # dentro do mesmo request — mas só é seguro se `g` foi de fato resetado.
    # Em produção (gunicorn/wsgi) Flask cria um app context novo por request,
    # então `g` zera entre requests. Em setups que mantêm o app context vivo
    # (testes com `with app.app_context()` global, alguns workers async), o
    # cache vazaria para a próxima request — bypass silencioso de auth.
    # Mitigação: validamos que o header atual realmente bate com o user em
    # cache antes de reaproveitá-lo.
    cached = getattr(g, "current_user", None)
    header = request.headers.get("Authorization", "").strip()
    cached_header = getattr(g, "_current_user_auth_header", None)
    if cached is not None and cached_header is not None and cached_header == header:
        return cached
    # Cache inválido para esta request — limpa antes de re-derivar.
    if cached is not None:
        g.current_user = None

    if not header:
        if optional:
            g.current_user = None
            g._current_user_auth_header = ""
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
    g._current_user_auth_header = header
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
