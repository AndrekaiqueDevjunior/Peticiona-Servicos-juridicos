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


def _configure_email_provider(app, monkeypatch):
    """Habilita o ramo 'provider configurado' do password_reset_service.

    Sem provider, o service entra em modo DRY-RUN e nunca chama
    send_email — então o spy `capture_emails` jamais captura nada.
    Setamos um SMTP_HOST fictício pra forçar o fluxo real (que aí cai
    no spy no monkeypatch).
    """
    monkeypatch.setitem(app.config, "SMTP_HOST", "smtp-dummy-for-tests")


def test_password_reset_round_trip(api_anonymous, app, db, monkeypatch):
    from tests.factories import create_client

    _configure_email_provider(app, monkeypatch)

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


def test_password_reset_for_unknown_email_keeps_generic_response(api_anonymous, app, monkeypatch):
    _configure_email_provider(app, monkeypatch)
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


def test_password_reset_falls_back_to_dry_run_without_provider(
    api_anonymous, app, db, monkeypatch, caplog
):
    """Sem provider configurado (RESEND/SENDGRID/SMTP), o backend não pode
    quebrar — entra em modo DRY-RUN, devolve 200 e loga o link como
    warning pra operador pegar no console. Isso era o caso onde a tela
    /forgot-password mostrava 503 em qualquer ambiente sem e-mail."""
    from tests.factories import create_client

    user = create_client(email="cliente@peticiona.app.br")
    db.session.commit()

    # Garante que NENHUM provider está configurado.
    for key in ("RESEND_API_KEY", "SENDGRID_API_KEY", "SMTP_HOST"):
        monkeypatch.setitem(app.config, key, "")

    emails = capture_emails(monkeypatch, target_module=password_reset_service)

    with caplog.at_level("WARNING"):
        response = api_anonymous.post(
            "/api/auth/password-reset/request",
            json={"email": user.email},
        )

    assert response.status_code == 200, response.get_data(as_text=True)
    # send_email não foi chamado (entra no dry-run antes)
    assert emails == []
    # Mas o link aparece no log
    log_text = "\n".join(record.getMessage() for record in caplog.records)
    assert "reset-password?token=" in log_text
