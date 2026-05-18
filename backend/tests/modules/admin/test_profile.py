"""Pilot tests para GET/PUT /api/admin/profile.

Cobertura nesta Fase 1:
- happy path: admin lê o próprio perfil
- RBAC: client e staff são bloqueados
- auth: sem token, token inválido, token expirado
- update: campos editáveis e validações simples (email vazio, e-mail duplicado)
"""

from __future__ import annotations

import pytest

from tests.utils.auth import expired_token, malformed_token


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


# ---------------------------------------------------------------------------
# GET /api/admin/profile
# ---------------------------------------------------------------------------


class TestGetAdminProfile:
    def test_returns_admin_data(self, api_admin, admin_user):
        response = api_admin.get("/api/admin/profile")

        assert response.status_code == 200
        body = response.get_json()
        assert body["id"] == admin_user.id
        assert body["email"] == admin_user.email
        assert body["role"] == "admin"
        # Campos esperados pelo contrato do frontend AdminProfile.tsx
        for field in (
            "full_name",
            "cpf",
            "oab_number",
            "phone",
            "zip_code",
            "city",
            "state",
            "created_at",
        ):
            assert field in body, f"Campo {field} ausente no profile"

    def test_anonymous_is_401(self, api_anonymous):
        response = api_anonymous.get("/api/admin/profile")
        assert response.status_code == 401

    def test_client_is_403(self, api_client):
        response = api_client.get("/api/admin/profile")
        assert response.status_code == 403

    def test_staff_is_403(self, api_staff):
        response = api_staff.get("/api/admin/profile")
        assert response.status_code == 403

    def test_invalid_token_is_401(self, client):
        response = client.get(
            "/api/admin/profile",
            headers={"Authorization": f"Bearer {malformed_token()}"},
        )
        assert response.status_code == 401

    def test_expired_token_is_401(self, client, admin_user):
        token = expired_token(admin_user)
        response = client.get(
            "/api/admin/profile",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_missing_bearer_scheme_is_401(self, client, admin_user, auth_token):
        token = auth_token(admin_user.id)
        response = client.get(
            "/api/admin/profile",
            headers={"Authorization": token},  # sem "Bearer "
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# PUT /api/admin/profile
# ---------------------------------------------------------------------------


class TestUpdateAdminProfile:
    def test_admin_updates_phone_and_address(self, api_admin):
        payload = {
            "phone": "+5511999998888",
            "zip_code": "01310-100",
            "street": "Av. Paulista",
            "street_number": "1000",
            "neighborhood": "Bela Vista",
            "city": "São Paulo",
            "state": "SP",
        }
        response = api_admin.put("/api/admin/profile", json=payload)
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        for key, value in payload.items():
            assert body[key] == value

    def test_email_empty_is_400(self, api_admin):
        response = api_admin.put("/api/admin/profile", json={"email": ""})
        assert response.status_code == 400
        assert response.get_json()["error"] == "VALIDATION_ERROR"

    def test_email_collision_is_409(self, api_admin, db):
        from tests.factories import create_client

        other = create_client(email="ocupado@example.com")
        db.session.commit()

        response = api_admin.put(
            "/api/admin/profile",
            json={"email": other.email},
        )
        assert response.status_code == 409
        assert response.get_json()["error"] == "CONFLICT"

    def test_client_cannot_update_admin_profile(self, api_client):
        response = api_client.put("/api/admin/profile", json={"phone": "+5511..."})
        assert response.status_code == 403
