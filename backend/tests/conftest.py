"""Fixtures principais da suíte de testes.

Estratégia de isolamento:
- App e banco SQLite em memória são recriados por teste (scope=function).
- `create_app` já cuida de `db.create_all()` + migrações + seed canônico.
- Nada do ambiente de produção é tocado: o `conftest.py` na raiz força
  variáveis seguras (CORS local, Pagar.me em dry-run, JWT secret de teste).

Toda fixture aqui é independente — testes podem rodar em paralelo
(`pytest -n auto`) sem compartilhar estado.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Iterator

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app import create_app
from app.core.extensions import db as _db
from app.core.jwt import create_access_token
from app.models import User


# ---------------------------------------------------------------------------
# App + banco
# ---------------------------------------------------------------------------


@pytest.fixture
def upload_dir(tmp_path: Path) -> Path:
    """Diretório temporário isolado para uploads — descartado ao fim do teste."""
    folder = tmp_path / "uploads"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


@pytest.fixture
def app(upload_dir: Path) -> Iterator[Flask]:
    """Aplicação Flask construída com SQLite em memória.

    `create_app` já roda `db.create_all()`, `run_runtime_migrations()` e
    `seed_reference_data()`, então cada teste começa com o catálogo canônico
    de planos/serviços disponível.
    """
    overrides = {
        "TESTING": True,
        "DEBUG": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_ENGINE_OPTIONS": {},  # remove pool_size etc. (não vale p/ sqlite)
        "UPLOAD_FOLDER": upload_dir,
        "MAX_UPLOAD_MB": 5,
        "SECRET_KEY": "test-secret-key-with-32-bytes-min__padding",
        "JWT_SECRET": "test-jwt-secret-with-32-bytes-min__padding",
        "JWT_EXPIRATION": 3600,
        "CORS_ALLOWED_ORIGINS": ["http://localhost:3000"],
        "RATE_LIMIT_ENABLED": False,
        "FRONTEND_URL": "http://localhost:3000",
        # Pagar.me + SMTP nunca podem chamar a rede em teste.
        "PAGARME_DRY_RUN": True,
        "PAGARME_SECRET_KEY": "sk_test_dummy",
        "PAGARME_PUBLIC_KEY": "pk_test_dummy",
        "PAGARME_WEBHOOK_TOKEN": "wh_test_token",
        "SMTP_HOST": "",
    }
    flask_app = create_app(overrides)
    with flask_app.app_context():
        yield flask_app
        _db.session.remove()


@pytest.fixture
def db(app: Flask):
    """Atalho para acesso direto ao SQLAlchemy dentro do app context."""
    return _db


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    """Cliente HTTP do Flask para chamadas crus (sem autenticação)."""
    return app.test_client()


# ---------------------------------------------------------------------------
# Helpers exportados
# ---------------------------------------------------------------------------


@pytest.fixture
def auth_token():
    """Factory de tokens JWT válidos para qualquer user_id.

    Uso:
        token = auth_token(user.id)
        client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    """

    def _build(user_id: int, *, expires_seconds: int | None = None) -> str:
        return create_access_token(user_id=user_id, expires_seconds=expires_seconds)

    return _build


@pytest.fixture
def auth_headers(auth_token):
    """Devolve dict de headers prontos para um dado usuário."""

    def _build(user: User | int) -> dict[str, str]:
        uid = user.id if isinstance(user, User) else int(user)
        return {"Authorization": f"Bearer {auth_token(uid)}"}

    return _build


# ---------------------------------------------------------------------------
# Usuários e ApiClient prontos para uso
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(app: Flask) -> User:
    from tests.factories import create_admin

    user = create_admin()
    _db.session.commit()
    return user


@pytest.fixture
def staff_user(app: Flask) -> User:
    from tests.factories import create_staff

    user = create_staff()
    _db.session.commit()
    return user


@pytest.fixture
def client_user(app: Flask) -> User:
    from tests.factories import create_client

    user = create_client()
    _db.session.commit()
    return user


@pytest.fixture
def api(client: FlaskClient):
    """Factory para `ApiClient` (autenticado opcionalmente)."""
    from tests.utils.client import ApiClient

    def _build(user: User | None = None) -> ApiClient:
        return ApiClient(client, user=user)

    return _build


@pytest.fixture
def api_admin(api, admin_user: User):
    return api(admin_user)


@pytest.fixture
def api_staff(api, staff_user: User):
    return api(staff_user)


@pytest.fixture
def api_client(api, client_user: User):
    return api(client_user)


@pytest.fixture
def api_anonymous(api):
    """Sem autenticação — para testar rotas que exigem login."""
    return api(None)


# ---------------------------------------------------------------------------
# Mocks de integração externa
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_pagarme(monkeypatch):
    """Substitui `PagarmeClient` por um mock que devolve `status=paid` por padrão.

    Cobre os imports mais comuns (`checkout_service`, `credit_payment_service`,
    rotas `payments`/`admin`). Devolve a instância para inspeção de chamadas.
    """
    from tests.utils.mocks import FakePagarmeClient

    fake = FakePagarmeClient(status="paid")

    targets = [
        "app.services.checkout_service.PagarmeClient",
        "app.services.credit_payment_service.PagarmeClient",
        "app.services.admin_service.PagarmeClient",
        "app.modules.payments.routes.PagarmeClient",
    ]
    for dotted in targets:
        try:
            monkeypatch.setattr(dotted, lambda fake=fake: fake)
        except AttributeError:
            # Caminho não importado nesse processo — tudo bem ignorar.
            continue
    return fake
