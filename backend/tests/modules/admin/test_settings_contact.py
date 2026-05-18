"""Testes para /api/admin/settings/contact (GET / PUT / PATCH).

ATENÇÃO: `settings_service` mantém estado global em `_CONTACT_OVERRIDE`
até que exista uma tabela de configurações. O fixture `reset_contact_settings`
faz a limpeza entre testes para garantir isolamento.
"""

from __future__ import annotations

import pytest

from app.services import settings_service


pytestmark = [pytest.mark.admin, pytest.mark.rbac]


@pytest.fixture(autouse=True)
def reset_contact_settings():
    """Garante que cada teste comece com o singleton zerado."""
    settings_service._CONTACT_OVERRIDE = None
    yield
    settings_service._CONTACT_OVERRIDE = None


class TestGetContactSettings:
    def test_admin_reads_defaults(self, api_admin):
        response = api_admin.get("/api/admin/settings/contact")
        assert response.status_code == 200
        body = response.get_json()
        # Os dois formatos de chave (camel e snake) devem estar presentes
        # — o frontend antigo lia camelCase.
        for key in ("email", "whatsappDisplay", "whatsappRaw", "whatsapp_display", "whatsapp_raw"):
            assert key in body
        assert "@" in body["email"]
        assert body["whatsapp_raw"].isdigit()

    def test_client_blocked(self, api_client):
        assert api_client.get("/api/admin/settings/contact").status_code == 403

    def test_staff_blocked(self, api_staff):
        assert api_staff.get("/api/admin/settings/contact").status_code == 403

    def test_anonymous_blocked(self, api_anonymous):
        assert api_anonymous.get("/api/admin/settings/contact").status_code == 401


class TestUpdateContactSettings:
    NEW = {
        "email": "novo@peticiona.app.br",
        "whatsappDisplay": "(21) 98888-7777",
        "whatsappRaw": "21988887777",
    }

    def test_put_persists_changes(self, api_admin):
        put = api_admin.put("/api/admin/settings/contact", json=self.NEW)
        assert put.status_code == 200
        body = put.get_json()
        assert body["email"] == self.NEW["email"]
        assert body["whatsappDisplay"] == self.NEW["whatsappDisplay"]
        # raw é normalizado: prefixo 55 quando entra com 11 dígitos
        assert body["whatsapp_raw"].endswith("21988887777")

        # GET subsequente devolve o valor atualizado
        refreshed = api_admin.get("/api/admin/settings/contact")
        assert refreshed.get_json()["email"] == self.NEW["email"]

    def test_patch_updates_partial(self, api_admin):
        # Primeiro define um estado conhecido
        api_admin.put("/api/admin/settings/contact", json=self.NEW)

        patch = api_admin.patch(
            "/api/admin/settings/contact",
            json={"email": "ainda-outro@example.com"},
        )
        assert patch.status_code == 200
        body = patch.get_json()
        assert body["email"] == "ainda-outro@example.com"
        # WhatsApp permanece do estado anterior
        assert body["whatsappDisplay"] == self.NEW["whatsappDisplay"]

    def test_empty_email_falls_back_to_default(self, api_admin):
        response = api_admin.put(
            "/api/admin/settings/contact",
            json={"email": "   ", "whatsappDisplay": "(11) 99999-0000"},
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["email"] == "contato@peticiona.app.br"

    def test_client_blocked_for_update(self, api_client):
        response = api_client.put("/api/admin/settings/contact", json=self.NEW)
        assert response.status_code == 403

    def test_staff_blocked_for_update(self, api_staff):
        response = api_staff.put("/api/admin/settings/contact", json=self.NEW)
        assert response.status_code == 403
