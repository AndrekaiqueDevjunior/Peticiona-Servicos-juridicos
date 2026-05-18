"""Cobertura de /api/admin/services (catálogo de serviços avulsos)."""

from __future__ import annotations

import pytest

from app.models import ServiceCatalogItem


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


class TestListServices:
    def test_admin_lists_seeded_services(self, api_admin):
        response = api_admin.get("/api/admin/services")
        assert response.status_code == 200
        services = response.get_json()["services"]
        codes = {s["code"] for s in services}
        # Seed canônico cria estes serviços
        assert "servico_peticao" in codes
        assert "servico_recurso" in codes

    def test_client_blocked(self, api_client):
        assert api_client.get("/api/admin/services").status_code == 403


class TestCreateService:
    def test_admin_creates_service(self, api_admin):
        response = api_admin.post(
            "/api/admin/services",
            json={
                "code": "servico_consulta",
                "section": "Consultoria",
                "title": "Parecer Jurídico",
                "description": "Consulta especializada",
                "unit_price": 35_000,
                "delivery_label": "Entrega em 5 dias",
            },
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()["service"]
        assert body["code"] == "servico_consulta"

    @pytest.mark.parametrize("missing", ["code", "section", "title"])
    def test_missing_required_fields_400(self, api_admin, missing):
        payload = {
            "code": "x",
            "section": "Sec",
            "title": "T",
            "unit_price": 100,
        }
        payload[missing] = "  "  # vazio após strip
        response = api_admin.post("/api/admin/services", json=payload)
        assert response.status_code == 400

    def test_duplicate_code_is_409(self, api_admin):
        api_admin.post(
            "/api/admin/services",
            json={"code": "servico_dup", "section": "X", "title": "T", "unit_price": 100},
        )
        second = api_admin.post(
            "/api/admin/services",
            json={"code": "servico_dup", "section": "X", "title": "T", "unit_price": 100},
        )
        assert second.status_code == 409

    def test_code_is_normalized_to_lowercase(self, api_admin):
        response = api_admin.post(
            "/api/admin/services",
            json={"code": "MIXED_CODE", "section": "X", "title": "T", "unit_price": 100},
        )
        assert response.status_code == 201
        assert response.get_json()["service"]["code"] == "mixed_code"


class TestUpdateDeleteService:
    def test_update_service_price(self, api_admin, db):
        from tests.factories import create_service_catalog_item

        item = create_service_catalog_item(unit_price=10_000)
        db.session.commit()

        response = api_admin.patch(
            f"/api/admin/services/{item.id}", json={"unit_price": 22_000, "is_active": False}
        )
        assert response.status_code == 200
        body = response.get_json()["service"]
        assert body["unit_price"] == 22_000

    def test_delete_soft_deletes(self, api_admin, db):
        from tests.factories import create_service_catalog_item

        item = create_service_catalog_item()
        item_id = item.id
        db.session.commit()

        response = api_admin.delete(f"/api/admin/services/{item_id}")
        assert response.status_code in (200, 204)
        persisted = db.session.get(ServiceCatalogItem, item_id)
        assert persisted is not None and persisted.is_active is False

    def test_delete_unknown_is_404(self, api_admin):
        assert api_admin.delete("/api/admin/services/999999").status_code == 404
