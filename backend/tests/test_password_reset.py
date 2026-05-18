"""Testes do fluxo de recuperação de senha.

Reescrito para usar a infra do conftest (app SQLite em memória + fixtures +
spy de e-mail compatível com kwargs futuros do `send_email`).
"""

from __future__ import annotations

import re

import pytest

import app.services.password_reset_service as password_reset_service
from app.core.security import verify_password
from app.models import User
from tests.utils.mocks import capture_emails


pytestmark = pytest.mark.auth


def test_password_reset_round_trip(api_anonymous, db, monkeypatch):
    from tests.factories import create_client

    user = create_client(email="andre@peticiona.app.br")
    db.session.commit()

    emails = capture_emails(monkeypatch, target_module=password_reset_service)

    request_resp = api_anonymous.post(
        "/api/auth/password-reset/request",
        json={"email": user.email},
    )
    assert request_resp.status_code == 200
    assert emails and emails[0]["to"] == user.email

    body = emails[0].get("body") or emails[0].get("html") or ""
    token_match = re.search(r"token=([^\s\"<>&]+)", body)
    assert token_match is not None, f"Token não encontrado no corpo do e-mail: {body[:200]}"

    confirm_resp = api_anonymous.post(
        "/api/auth/password-reset/confirm",
        json={"token": token_match.group(1), "password": "NovaSenha@123"},
    )
    assert confirm_resp.status_code == 200

    refreshed = db.session.get(User, user.id)
    assert verify_password("NovaSenha@123", refreshed.password_hash)


def test_password_reset_for_unknown_email_keeps_generic_response(api_anonymous, monkeypatch):
    emails = capture_emails(monkeypatch, target_module=password_reset_service)

    response = api_anonymous.post(
        "/api/auth/password-reset/request",
        json={"email": "naoexiste@peticiona.app.br"},
    )

    # Resposta genérica (200) para não vazar enumeração de e-mails,
    # e nenhum e-mail enviado.
    assert response.status_code == 200
    assert response.get_json().get("message")
    assert emails == []
