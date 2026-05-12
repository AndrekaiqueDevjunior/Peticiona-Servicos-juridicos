from __future__ import annotations

import re
import sys

sys.path.insert(0, "backend")

import app.services.password_reset_service as password_reset_service
from app import create_app
from app.core.extensions import db
from app.core.security import hash_password, verify_password
from app.models import User


def build_app():
    return create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "FRONTEND_URL": "https://peticiona.app.br",
            "SECRET_KEY": "test-secret",
            "UPLOAD_FOLDER": "/tmp/peticiona-uploads",
        }
    )


def test_password_reset_round_trip():
    captured: dict[str, str] = {}

    def fake_send_email(*, to: str, subject: str, body: str) -> bool:
        captured["to"] = to
        captured["subject"] = subject
        captured["body"] = body
        return True

    password_reset_service.send_email = fake_send_email

    app = build_app()
    with app.app_context():
        user = User(
            full_name="Andre Teste",
            email="andre@peticiona.app.br",
            password_hash=hash_password("Senha@123"),
            role="client",
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()

    client = app.test_client()
    response = client.post(
        "/api/auth/password-reset/request",
        json={"email": "andre@peticiona.app.br"},
    )
    assert response.status_code == 200
    assert captured["to"] == "andre@peticiona.app.br"

    match = re.search(r"token=([^\s]+)", captured["body"])
    assert match is not None

    confirm = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": match.group(1), "password": "NovaSenha@123"},
    )
    assert confirm.status_code == 200

    with app.app_context():
        user = User.query.filter_by(email="andre@peticiona.app.br").first()
        assert user is not None
        assert verify_password("NovaSenha@123", user.password_hash)


def test_password_reset_for_unknown_email_keeps_generic_response():
    sent = {"called": False}

    def fake_send_email(*, to: str, subject: str, body: str) -> bool:
        sent["called"] = True
        return True

    password_reset_service.send_email = fake_send_email

    app = build_app()
    client = app.test_client()
    response = client.post(
        "/api/auth/password-reset/request",
        json={"email": "naoexiste@peticiona.app.br"},
    )

    assert response.status_code == 200
    assert response.get_json()["message"]
    assert sent["called"] is False
