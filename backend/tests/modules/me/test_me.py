"""Cobertura de /api/me (perfil + balance + documents + terms + password)."""

from __future__ import annotations

import pytest

from app.core.security import verify_password
from tests.factories import UserFactory


pytestmark = [pytest.mark.auth, pytest.mark.integration]


# ---------------------------------------------------------------------------
# GET / PUT /api/me
# ---------------------------------------------------------------------------


class TestGetProfile:
    def test_returns_own_profile(self, api_client, client_user):
        response = api_client.get("/api/me")
        assert response.status_code == 200
        body = response.get_json()
        assert body["email"] == client_user.email
        assert body["role"] == "client"

    def test_anonymous_is_401(self, api_anonymous):
        assert api_anonymous.get("/api/me").status_code == 401


class TestUpdateProfile:
    def test_updates_full_name_and_phone(self, api_client):
        response = api_client.put(
            "/api/me",
            json={"full_name": "Novo Nome", "phone": "+5511999999999"},
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["full_name"] == "Novo Nome"
        assert body["phone"] == "+5511999999999"

    def test_updates_address(self, api_client):
        response = api_client.patch(
            "/api/me",
            json={"city": "Curitiba", "state": "pr", "zip_code": "80000-000"},
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["city"] == "Curitiba"
        # UF normalizado para maiúscula 2 chars
        assert body["state"] == "PR"

    def test_empty_full_name_is_400(self, api_client):
        response = api_client.put("/api/me", json={"full_name": "   "})
        assert response.status_code == 400

    def test_empty_email_is_400(self, api_client):
        response = api_client.put("/api/me", json={"email": ""})
        assert response.status_code == 400

    def test_email_collision_is_409(self, api_client, db):
        from tests.factories import create_client

        other = create_client(email="ocupado@example.com")
        db.session.commit()

        response = api_client.put("/api/me", json={"email": other.email})
        assert response.status_code == 409


# ---------------------------------------------------------------------------
# GET /api/me/balance
# ---------------------------------------------------------------------------


class TestBalance:
    def test_empty_balance(self, api_client):
        response = api_client.get("/api/me/balance")
        assert response.status_code == 200
        body = response.get_json()
        assert body["credits_available_cents"] == 0
        assert body["credits_available_brl"] == "0 crédito(s)"
        assert body["movements"] == []

    def test_reflects_credit_transactions(self, api_client, client_user, db):
        from tests.factories import create_credit_transaction

        create_credit_transaction(user=client_user, amount=50_000, type="in")
        create_credit_transaction(user=client_user, amount=10_000, type="out")
        db.session.commit()

        response = api_client.get("/api/me/balance")
        body = response.get_json()
        assert body["credits_total_cents"] == 50_000
        assert body["credits_used_cents"] == 10_000
        assert body["credits_available_cents"] == 40_000
        assert len(body["movements"]) == 2

    def test_anonymous_blocked(self, api_anonymous):
        assert api_anonymous.get("/api/me/balance").status_code == 401


# ---------------------------------------------------------------------------
# GET /api/me/documents
# ---------------------------------------------------------------------------


class TestMyDocuments:
    def test_lists_own_documents_only(self, api_client, client_user, db):
        from tests.factories import create_client, create_document

        my_doc = create_document(user=client_user, file_name="meu.pdf")
        other_user = create_client(email="outro@example.com")
        create_document(user=other_user, file_name="alheio.pdf")
        db.session.commit()

        response = api_client.get("/api/me/documents")
        assert response.status_code == 200
        files = [d["file_name"] for d in response.get_json()["documents"]]
        assert "meu.pdf" in files
        assert "alheio.pdf" not in files

    def test_anonymous_blocked(self, api_anonymous):
        assert api_anonymous.get("/api/me/documents").status_code == 401


# ---------------------------------------------------------------------------
# Termos: GET /api/me/terms  +  POST /api/me/terms
# ---------------------------------------------------------------------------


class TestTermsAcceptance:
    def test_not_accepted_initially(self, api_client):
        response = api_client.get("/api/me/terms")
        assert response.status_code == 200
        body = response.get_json()
        assert body["accepted"] is False
        assert body["current_version"]

    def test_accept_terms_then_status_reflects(self, api_client):
        post = api_client.post("/api/me/terms")
        assert post.status_code == 200
        assert post.get_json()["accepted"] is True

        # GET subsequente confirma
        get = api_client.get("/api/me/terms").get_json()
        assert get["accepted"] is True

    def test_accept_is_idempotent(self, api_client):
        first = api_client.post("/api/me/terms").get_json()
        second = api_client.post("/api/me/terms").get_json()
        # Mesma aceitação retornada — não duplica
        assert first["acceptance"]["id"] == second["acceptance"]["id"]


# ---------------------------------------------------------------------------
# POST /api/me/password
# ---------------------------------------------------------------------------


class TestChangePassword:
    def test_changes_password_with_correct_current(self, api_client, client_user, db):
        response = api_client.post(
            "/api/me/password",
            json={
                "current_password": UserFactory.DEFAULT_PASSWORD,
                "new_password": "NovaSenha@2025",
            },
        )
        assert response.status_code == 200
        assert response.get_json()["ok"] is True

        db.session.refresh(client_user)
        assert verify_password("NovaSenha@2025", client_user.password_hash)

    def test_wrong_current_password_is_400(self, api_client):
        response = api_client.post(
            "/api/me/password",
            json={"current_password": "errada", "new_password": "NovaSenha@123"},
        )
        assert response.status_code == 400
        assert "senha atual" in response.get_json()["message"].lower()

    def test_short_new_password_is_400(self, api_client):
        response = api_client.post(
            "/api/me/password",
            json={"current_password": UserFactory.DEFAULT_PASSWORD, "new_password": "123"},
        )
        assert response.status_code == 400

    def test_same_password_is_400(self, api_client):
        response = api_client.post(
            "/api/me/password",
            json={
                "current_password": UserFactory.DEFAULT_PASSWORD,
                "new_password": UserFactory.DEFAULT_PASSWORD,
            },
        )
        assert response.status_code == 400

    def test_missing_fields_400(self, api_client):
        assert api_client.post("/api/me/password", json={}).status_code == 400

    def test_anonymous_blocked(self, api_anonymous):
        response = api_anonymous.post(
            "/api/me/password",
            json={"current_password": "x", "new_password": "y"},
        )
        assert response.status_code == 401
