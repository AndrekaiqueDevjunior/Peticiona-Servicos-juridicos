"""Testes do endpoint POST /api/auth/register."""

from __future__ import annotations

import pytest

from app.models import User


pytestmark = pytest.mark.auth


VALID_PAYLOAD = {
    "full_name": "Joana Cliente",
    "email": "joana@example.com",
    "password": "Senha@123",
    "confirm_password": "Senha@123",
    "oab_number": "SP/123456",
    "cpf": "111.222.333-44",
    "phone": "+5511988887777",
}


class TestRegisterSuccess:
    def test_creates_user_and_returns_token(self, api_anonymous, db):
        response = api_anonymous.post("/api/auth/register", json=VALID_PAYLOAD)
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        assert body["token"]
        assert body["user"]["email"] == "joana@example.com"
        assert body["user"]["role"] == "client"

        persisted = User.query.filter_by(email="joana@example.com").first()
        assert persisted is not None
        assert persisted.company_id, "Registrar deve criar Company para o usuário"
        assert persisted.active_plan_id, "Usuário deve receber plano default (seed)"

    def test_email_is_normalized_to_lowercase(self, api_anonymous):
        payload = {**VALID_PAYLOAD, "email": "MIXEDcase@Example.COM"}
        response = api_anonymous.post("/api/auth/register", json=payload)
        assert response.status_code == 200
        assert response.get_json()["user"]["email"] == "mixedcase@example.com"


class TestRegisterValidation:
    @pytest.mark.parametrize(
        "field, message",
        [
            ("full_name", "Nome completo"),
            ("email", "E-mail"),
        ],
    )
    def test_missing_required_fields_return_400(self, api_anonymous, field, message):
        payload = {**VALID_PAYLOAD, field: ""}
        response = api_anonymous.post("/api/auth/register", json=payload)
        assert response.status_code == 400
        body = response.get_json()
        assert body["error"] == "VALIDATION_ERROR"
        assert message.lower() in body["message"].lower()

    def test_short_password_is_400(self, api_anonymous):
        payload = {**VALID_PAYLOAD, "password": "1234567", "confirm_password": "1234567"}
        response = api_anonymous.post("/api/auth/register", json=payload)
        assert response.status_code == 400
        assert "8 caracteres" in response.get_json()["message"]

    def test_password_mismatch_is_400(self, api_anonymous):
        payload = {**VALID_PAYLOAD, "confirm_password": "outra@senha"}
        response = api_anonymous.post("/api/auth/register", json=payload)
        assert response.status_code == 400

    def test_non_dict_body_is_400(self, api_anonymous):
        response = api_anonymous.post("/api/auth/register", json=[1, 2, 3])
        assert response.status_code == 400


class TestRegisterConflict:
    def test_duplicate_email_is_409(self, api_anonymous, db):
        first = api_anonymous.post("/api/auth/register", json=VALID_PAYLOAD)
        assert first.status_code == 200

        # Segunda tentativa com mesmo e-mail mas dados diferentes deve colidir.
        second_payload = {
            **VALID_PAYLOAD,
            "full_name": "Outro Joana",
            "cpf": "999.888.777-66",
        }
        second = api_anonymous.post("/api/auth/register", json=second_payload)
        assert second.status_code == 409
        assert second.get_json()["error"] == "CONFLICT"
