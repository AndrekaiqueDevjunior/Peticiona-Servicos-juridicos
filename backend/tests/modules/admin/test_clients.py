"""Cobertura de /api/admin/clients (CRUD + RBAC)."""

from __future__ import annotations

import pytest

from app.core.security import verify_password
from app.models import User


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


VALID_CLIENT_PAYLOAD = {
    "full_name": "Maria Cliente",
    "email": "maria@example.com",
    "password": "Senha@123",
    "cpf": "123.456.789-00",
    "phone": "+5511988887777",
    "oab_number": "SP/123456",
}


class TestListClients:
    def test_admin_lists_existing_clients(self, api_admin, client_user, db):
        from tests.factories import create_client

        create_client(email="extra1@example.com")
        create_client(email="extra2@example.com")
        db.session.commit()

        response = api_admin.get("/api/admin/clients")
        assert response.status_code == 200
        clients = response.get_json()["clients"]
        emails = {c["email"] for c in clients}
        assert client_user.email in emails
        assert "extra1@example.com" in emails

    def test_client_blocked(self, api_client):
        assert api_client.get("/api/admin/clients").status_code == 403

    def test_staff_blocked(self, api_staff):
        assert api_staff.get("/api/admin/clients").status_code == 403


class TestCreateClient:
    def test_admin_creates_full_client(self, api_admin, db):
        response = api_admin.post("/api/admin/clients", json=VALID_CLIENT_PAYLOAD)
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert body["client"]["email"] == "maria@example.com"

        # Senha foi hasheada e usuário pode logar
        persisted = User.query.filter_by(email="maria@example.com").first()
        assert persisted is not None
        assert verify_password("Senha@123", persisted.password_hash)
        assert persisted.role == "client"
        assert persisted.is_active is True

    def test_missing_full_name_is_400(self, api_admin):
        payload = {**VALID_CLIENT_PAYLOAD, "full_name": "  "}
        response = api_admin.post("/api/admin/clients", json=payload)
        assert response.status_code == 400

    def test_missing_email_is_400(self, api_admin):
        payload = {**VALID_CLIENT_PAYLOAD, "email": ""}
        response = api_admin.post("/api/admin/clients", json=payload)
        assert response.status_code == 400

    def test_short_password_is_400(self, api_admin):
        payload = {**VALID_CLIENT_PAYLOAD, "password": "1234"}
        response = api_admin.post("/api/admin/clients", json=payload)
        assert response.status_code == 400

    def test_duplicate_email_is_409(self, api_admin):
        api_admin.post("/api/admin/clients", json=VALID_CLIENT_PAYLOAD)
        second = api_admin.post("/api/admin/clients", json=VALID_CLIENT_PAYLOAD)
        assert second.status_code == 409

    def test_client_role_blocked(self, api_client):
        response = api_client.post("/api/admin/clients", json=VALID_CLIENT_PAYLOAD)
        assert response.status_code == 403


class TestGetUpdateDeleteClient:
    def test_admin_reads_client_detail(self, api_admin, db):
        from tests.factories import create_client

        target = create_client(email="lookup@example.com")
        db.session.commit()

        response = api_admin.get(f"/api/admin/clients/{target.id}")
        assert response.status_code == 200
        assert response.get_json()["client"]["email"] == "lookup@example.com"

    def test_unknown_client_is_404(self, api_admin):
        assert api_admin.get("/api/admin/clients/9999").status_code == 404

    def test_cannot_get_staff_via_clients_endpoint(self, api_admin, staff_user):
        # /clients filtra por role=client; tentar abrir um staff por aqui deve 404
        response = api_admin.get(f"/api/admin/clients/{staff_user.id}")
        assert response.status_code == 404

    def test_update_changes_phone_and_address(self, api_admin, db):
        from tests.factories import create_client

        target = create_client(email="upd@example.com")
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/clients/{target.id}",
            json={"phone": "+5511900000000", "city": "Campinas", "state": "sp"},
        )
        assert response.status_code == 200
        body = response.get_json()["client"]
        assert body["city"] == "Campinas"
        # UF é normalizado para maiúscula e cortado em 2 chars
        assert body["state"] == "SP"

    def test_password_update_optional(self, api_admin, db):
        from tests.factories import create_client

        target = create_client(email="pw@example.com")
        original_hash = target.password_hash
        db.session.commit()

        # PATCH sem campo password não muda o hash
        api_admin.patch(f"/api/admin/clients/{target.id}", json={"city": "Rio"})
        db.session.refresh(target)
        assert target.password_hash == original_hash

        # PATCH com password nova atualiza o hash
        api_admin.patch(
            f"/api/admin/clients/{target.id}", json={"password": "NovaSenha@123"}
        )
        db.session.refresh(target)
        assert verify_password("NovaSenha@123", target.password_hash)

    def test_email_collision_on_update_is_409(self, api_admin, db):
        from tests.factories import create_client

        first = create_client(email="primeiro@example.com")
        second = create_client(email="segundo@example.com")
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/clients/{second.id}",
            json={"email": "primeiro@example.com"},
        )
        assert response.status_code == 409

    def test_delete_soft_deactivates_client(self, api_admin, db):
        from tests.factories import create_client

        target = create_client(email="todelete@example.com")
        db.session.commit()

        response = api_admin.delete(f"/api/admin/clients/{target.id}")
        assert response.status_code in (200, 204)
        db.session.refresh(target)
        # Soft-delete: a linha continua, mas is_active=False
        assert target.is_active is False

    def test_client_blocked_for_update(self, api_client, client_user):
        response = api_client.patch(
            f"/api/admin/clients/{client_user.id}", json={"phone": "x"}
        )
        assert response.status_code == 403
