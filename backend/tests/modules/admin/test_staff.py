"""Cobertura de /api/admin/staff (CRUD + RBAC + contadores de pedidos)."""

from __future__ import annotations

import pytest


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


VALID_STAFF_PAYLOAD = {
    "full_name": "Pedro Funcionário",
    "email": "pedro@example.com",
    "password": "Senha@123",
    "cpf": "987.654.321-00",
    "phone": "+5511977776666",
    "oab_number": "SP/654321",
    "role_title": "Redator Senior",
    "employee_code": "PT-EQ-0001",
}


class TestListStaff:
    def test_admin_lists_staff_with_order_counts(self, api_admin, db):
        from tests.factories import create_client, create_service_order, create_staff

        staff = create_staff(email="redator@example.com")
        client = create_client(email="cli@example.com")
        create_service_order(user=client, staff_user=staff, status="pendente")
        create_service_order(user=client, staff_user=staff, status="concluido")
        db.session.commit()

        response = api_admin.get("/api/admin/staff")
        assert response.status_code == 200
        entries = response.get_json()["staff"]
        assert entries, "Listagem de staff veio vazia"
        target = next((e for e in entries if e["email"] == "redator@example.com"), None)
        assert target is not None
        # Contadores derivados das ServiceOrders associadas
        assert target["pedidos_concluidos"] == 1
        assert target["pedidos_ativos"] == 1

    def test_client_blocked(self, api_client):
        assert api_client.get("/api/admin/staff").status_code == 403

    def test_staff_role_blocked_for_admin_endpoint(self, api_staff):
        assert api_staff.get("/api/admin/staff").status_code == 403


class TestCreateStaff:
    def test_admin_creates_staff_with_201(self, api_admin):
        response = api_admin.post("/api/admin/staff", json=VALID_STAFF_PAYLOAD)
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert body["staff_member"]["email"] == "pedro@example.com"

    def test_duplicate_email_is_409(self, api_admin):
        api_admin.post("/api/admin/staff", json=VALID_STAFF_PAYLOAD)
        second = api_admin.post("/api/admin/staff", json=VALID_STAFF_PAYLOAD)
        assert second.status_code == 409

    def test_short_password_is_400(self, api_admin):
        payload = {**VALID_STAFF_PAYLOAD, "password": "123"}
        response = api_admin.post("/api/admin/staff", json=payload)
        assert response.status_code == 400


class TestGetUpdateDeleteStaff:
    def test_get_unknown_staff_is_404(self, api_admin):
        assert api_admin.get("/api/admin/staff/99999").status_code == 404

    def test_cannot_get_client_through_staff_endpoint(self, api_admin, client_user):
        # /staff/<id> filtra por role="staff"; um cliente nunca aparece aqui
        response = api_admin.get(f"/api/admin/staff/{client_user.id}")
        assert response.status_code == 404

    def test_update_role_title_and_employee_code(self, api_admin, db):
        from tests.factories import create_staff

        target = create_staff(email="updstaff@example.com")
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/staff/{target.id}",
            json={"role_title": "Coordenador", "employee_code": "PT-EQ-0099"},
        )
        assert response.status_code == 200
        member = response.get_json()["staff_member"]
        assert member["role_title"] == "Coordenador"
        assert member["employee_code"] == "PT-EQ-0099"

    def test_delete_soft_deactivates(self, api_admin, db):
        from tests.factories import create_staff

        target = create_staff(email="del@example.com")
        db.session.commit()

        response = api_admin.delete(f"/api/admin/staff/{target.id}")
        assert response.status_code == 204
        db.session.refresh(target)
        assert target.is_active is False
