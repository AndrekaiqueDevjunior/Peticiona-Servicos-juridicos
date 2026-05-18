"""Fluxo ponta-a-ponta do cliente.

Responde a verificação solicitada:
- cliente loga → ✔
- cliente lista e abre seus pedidos → ✔
- cliente edita o pedido enquanto está `pendente` → ✔
- cliente NÃO pode editar pedido fora de `pendente` → ✔ (regra de negócio)
- cliente faz upload de documento → ✔
- cliente baixa o próprio documento → ✔
- cliente NÃO baixa documento de outro cliente → ✔ (RBAC)
"""

from __future__ import annotations

import io

import pytest

from tests.factories import UserFactory, create_client, create_petition, create_service_order


pytestmark = [pytest.mark.client, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Fixtures locais — montam uma jornada realista
# ---------------------------------------------------------------------------


@pytest.fixture
def client_with_pending_order(db, client_user):
    petition = create_petition(user=client_user)
    order = create_service_order(
        user=client_user,
        petition=petition,
        status="pendente",
        total_amount=18_000,
    )
    db.session.commit()
    return client_user, order


@pytest.fixture
def client_token(api_anonymous, client_user):
    """Token JWT real, obtido via POST /api/auth/login (não shortcut)."""
    resp = api_anonymous.post(
        "/api/auth/login",
        json={
            "email": client_user.email,
            "password": UserFactory.DEFAULT_PASSWORD,
            "remember": False,
        },
    )
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()["token"]


# ---------------------------------------------------------------------------
# Login + listagem
# ---------------------------------------------------------------------------


def test_logged_client_lists_only_own_orders(api, db, client_with_pending_order):
    me, my_order = client_with_pending_order

    other = create_client(email="outro@example.com")
    create_service_order(user=other, total_amount=99_999)
    db.session.commit()

    response = api(me).get("/api/client-area/orders")
    assert response.status_code == 200
    orders = response.get_json()["orders"]
    ids = [o["id"] for o in orders]
    assert my_order.id in ids
    # O pedido do outro cliente não pode aparecer
    other_ids = {o["id"] for o in orders if o.get("user_id") == other.id}
    assert other_ids == set()


def test_logged_client_can_open_own_order(api, client_with_pending_order):
    me, order = client_with_pending_order
    response = api(me).get(f"/api/client-area/orders/{order.id}")
    assert response.status_code == 200
    body = response.get_json()
    assert body["order"]["id"] == order.id


def test_logged_client_cannot_open_other_clients_order(api, db, client_with_pending_order):
    me, _ = client_with_pending_order
    other = create_client(email="alheio@example.com")
    other_order = create_service_order(user=other)
    db.session.commit()

    response = api(me).get(f"/api/client-area/orders/{other_order.id}")
    assert response.status_code == 404, "Pedido de outro cliente deve ser invisível"


# ---------------------------------------------------------------------------
# Edição
# ---------------------------------------------------------------------------


class TestClientCanEditOrder:
    def test_patch_updates_petition_fields(self, api, client_with_pending_order):
        me, order = client_with_pending_order
        response = api(me).patch(
            f"/api/client-area/orders/{order.id}",
            json={
                "tipo_peticao": "Contestação",
                "resumo_caso": "Resumo atualizado pelo cliente",
                "justica_gratuita": True,
            },
        )
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        petition = body["order"]["petition"]
        assert petition["tipo_peticao"] == "Contestação"
        assert petition["resumo_caso"] == "Resumo atualizado pelo cliente"
        assert petition["justica_gratuita"] is True

    def test_cannot_edit_order_after_started(self, api, db, client_with_pending_order):
        me, order = client_with_pending_order
        order.status = "em_andamento"
        db.session.commit()

        response = api(me).patch(
            f"/api/client-area/orders/{order.id}",
            json={"resumo_caso": "tentando editar fora do permitido"},
        )
        assert response.status_code == 400
        assert "pendente" in response.get_json()["message"].lower()

    def test_cannot_edit_other_clients_order(self, api, db, client_with_pending_order):
        me, _ = client_with_pending_order
        other = create_client(email="alguem@example.com")
        other_order = create_service_order(user=other, status="pendente")
        db.session.commit()

        response = api(me).patch(
            f"/api/client-area/orders/{other_order.id}",
            json={"resumo_caso": "invasão"},
        )
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Upload + Download
# ---------------------------------------------------------------------------


PDF_HEADER = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer<<>>\n%%EOF\n"


def _pdf_upload_field():
    return {"documents": (io.BytesIO(PDF_HEADER), "pedido-teste.pdf")}


class TestClientDocuments:
    def test_upload_creates_document(self, api, client_user, upload_dir):
        response = api(client_user).post(
            "/api/client-area/documents",
            data=_pdf_upload_field(),
            content_type="multipart/form-data",
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert len(body["documents"]) == 1
        doc = body["documents"][0]
        assert doc["file_name"].endswith(".pdf")
        assert doc["download_url"].startswith("/api/documents/")
        # O arquivo foi gravado no upload_dir injetado pela fixture
        stored_files = list(upload_dir.iterdir())
        assert len(stored_files) == 1, "Documento físico deve estar em UPLOAD_FOLDER"

    def test_owner_can_download_own_document(self, api, client_user):
        upload_resp = api(client_user).post(
            "/api/client-area/documents",
            data=_pdf_upload_field(),
            content_type="multipart/form-data",
        )
        doc = upload_resp.get_json()["documents"][0]

        download = api(client_user).get(doc["download_url"])
        assert download.status_code == 200
        assert download.data == PDF_HEADER
        # Cabeçalho de download forçado para arquivo
        assert "attachment" in download.headers.get("Content-Disposition", "").lower()

    def test_other_client_cannot_download(self, api, client_user, db):
        upload_resp = api(client_user).post(
            "/api/client-area/documents",
            data=_pdf_upload_field(),
            content_type="multipart/form-data",
        )
        doc = upload_resp.get_json()["documents"][0]

        # Outro cliente tenta baixar — deve receber 403
        intruder = create_client(email="intruso@example.com")
        db.session.commit()

        response = api(intruder).get(doc["download_url"])
        assert response.status_code == 403

    def test_anonymous_cannot_download(self, api_anonymous, api, client_user):
        upload_resp = api(client_user).post(
            "/api/client-area/documents",
            data=_pdf_upload_field(),
            content_type="multipart/form-data",
        )
        doc = upload_resp.get_json()["documents"][0]

        response = api_anonymous.get(doc["download_url"])
        assert response.status_code == 401

    def test_invalid_extension_rejected(self, api, client_user):
        response = api(client_user).post(
            "/api/client-area/documents",
            data={"documents": (io.BytesIO(b"#!/bin/sh\nrm -rf /\n"), "malicious.sh")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Login via token "real" (smoke do contrato)
# ---------------------------------------------------------------------------


def test_login_then_use_token_to_access_client_area(client, client_token):
    """Garante que o JWT retornado pelo /auth/login é aceito pelas demais rotas."""
    resp = client.get(
        "/api/client-area/orders",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert resp.status_code == 200
