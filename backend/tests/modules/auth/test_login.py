"""Smoke tests do endpoint POST /api/auth/login.

Pilot Fase 1: garante que a stack (app + db SQLite + fixtures + ApiClient)
está saudável antes de expandir cobertura.
"""

from __future__ import annotations

import pytest

from tests.factories import UserFactory


pytestmark = pytest.mark.auth


def test_login_success_returns_token_and_user_profile(api_anonymous, client_user):
    response = api_anonymous.post(
        "/api/auth/login",
        json={
            "email": client_user.email,
            "password": UserFactory.DEFAULT_PASSWORD,
            "remember": False,
        },
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["token"], "Login bem-sucedido deve retornar um token JWT"
    assert body["user"]["email"] == client_user.email
    assert body["user"]["role"] == "client"


def test_login_with_wrong_password_returns_401(api_anonymous, client_user):
    response = api_anonymous.post(
        "/api/auth/login",
        json={"email": client_user.email, "password": "senha-errada"},
    )
    assert response.status_code == 401
    assert response.get_json()["error"] == "AUTH_REQUIRED"


def test_login_unknown_email_returns_401(api_anonymous):
    response = api_anonymous.post(
        "/api/auth/login",
        json={"email": "nao-existe@example.com", "password": "qualquer"},
    )
    assert response.status_code == 401


def test_login_missing_fields_returns_400(api_anonymous):
    response = api_anonymous.post("/api/auth/login", json={"email": "foo@bar.com"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "VALIDATION_ERROR"


def test_login_inactive_user_returns_401(api_anonymous, db):
    from tests.factories import create_client

    inactive = create_client(email="inactive@example.com", is_active=False)
    db.session.commit()

    response = api_anonymous.post(
        "/api/auth/login",
        json={"email": inactive.email, "password": UserFactory.DEFAULT_PASSWORD},
    )
    assert response.status_code == 401
