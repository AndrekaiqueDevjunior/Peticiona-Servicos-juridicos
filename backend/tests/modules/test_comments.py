"""Cobertura de /api/orders/<id>/comments (cliente ↔ staff ↔ admin)
e /api/orders/<id>/documents (upload anexado a um pedido)."""

from __future__ import annotations

import io

import pytest

from app.core.extensions import db as _db


pytestmark = [pytest.mark.client, pytest.mark.integration]


PDF_HEADER = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer<<>>\n%%EOF\n"


# ---------------------------------------------------------------------------
# Fixtures locais
# ---------------------------------------------------------------------------


@pytest.fixture
def client_order(db, client_user):
    from tests.factories import create_service_order

    order = create_service_order(user=client_user, total_amount=18_000, status="pendente")
    db.session.commit()
    return order


# ---------------------------------------------------------------------------
# GET /api/orders/<id>/comments
# ---------------------------------------------------------------------------


class TestListComments:
    def test_empty_when_no_comments(self, api_client, client_order):
        response = api_client.get(f"/api/orders/{client_order.id}/comments")
        assert response.status_code == 200
        assert response.get_json()["comments"] == []

    def test_owner_lists_own_comments(self, api_client, client_user, client_order):
        api_client.post(
            f"/api/orders/{client_order.id}/comments", json={"text": "Olá redator"}
        )
        response = api_client.get(f"/api/orders/{client_order.id}/comments")
        comments = response.get_json()["comments"]
        assert len(comments) == 1
        assert comments[0]["author_role"] == "client"
        assert comments[0]["text"] == "Olá redator"

    def test_other_client_forbidden(self, api, db, client_order):
        from tests.factories import create_client

        intruder = create_client(email="intruder@example.com")
        db.session.commit()

        response = api(intruder).get(f"/api/orders/{client_order.id}/comments")
        assert response.status_code == 403

    def test_staff_can_list_comments(self, api_staff, client_order):
        response = api_staff.get(f"/api/orders/{client_order.id}/comments")
        assert response.status_code == 200

    def test_admin_can_list_comments(self, api_admin, client_order):
        response = api_admin.get(f"/api/orders/{client_order.id}/comments")
        assert response.status_code == 200

    def test_anonymous_blocked(self, api_anonymous, client_order):
        response = api_anonymous.get(f"/api/orders/{client_order.id}/comments")
        assert response.status_code == 401

    def test_unknown_order_is_404(self, api_admin):
        response = api_admin.get("/api/orders/999999/comments")
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/orders/<id>/comments
# ---------------------------------------------------------------------------


class TestAddComment:
    def test_client_creates_comment(self, api_client, client_order):
        response = api_client.post(
            f"/api/orders/{client_order.id}/comments",
            json={"text": "Adicionei mais documentos."},
        )
        assert response.status_code == 201, response.get_json()
        comment = response.get_json()["comment"]
        assert comment["text"] == "Adicionei mais documentos."
        assert comment["author_role"] == "client"

    def test_staff_creates_comment(self, api_staff, client_order):
        response = api_staff.post(
            f"/api/orders/{client_order.id}/comments",
            json={"text": "Peça em revisão final."},
        )
        assert response.status_code == 201
        assert response.get_json()["comment"]["author_role"] == "staff"

    def test_empty_comment_is_400(self, api_client, client_order):
        response = api_client.post(
            f"/api/orders/{client_order.id}/comments", json={"text": "   "}
        )
        assert response.status_code == 400

    def test_oversized_comment_is_400(self, api_client, client_order):
        response = api_client.post(
            f"/api/orders/{client_order.id}/comments", json={"text": "x" * 5001}
        )
        assert response.status_code == 400

    def test_other_client_cannot_comment(self, api, db, client_order):
        from tests.factories import create_client

        intruder = create_client(email="x@y.com")
        db.session.commit()

        response = api(intruder).post(
            f"/api/orders/{client_order.id}/comments", json={"text": "hack"}
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /api/orders/<id>/comments/<id>
# ---------------------------------------------------------------------------


class TestDeleteComment:
    def _post(self, api, order_id, text):
        return api.post(
            f"/api/orders/{order_id}/comments", json={"text": text}
        ).get_json()["comment"]

    def test_author_deletes_own_comment(self, api_client, client_order):
        comment = self._post(api_client, client_order.id, "rascunho")
        response = api_client.delete(
            f"/api/orders/{client_order.id}/comments/{comment['id']}"
        )
        assert response.status_code == 200
        assert response.get_json()["deleted"] is True

    def test_client_cannot_delete_staff_comment(
        self, api_client, api_staff, client_order
    ):
        staff_comment = self._post(api_staff, client_order.id, "comentário interno")
        response = api_client.delete(
            f"/api/orders/{client_order.id}/comments/{staff_comment['id']}"
        )
        assert response.status_code == 403

    def test_admin_deletes_anyones_comment(
        self, api_client, api_admin, client_order
    ):
        client_comment = self._post(api_client, client_order.id, "do cliente")
        response = api_admin.delete(
            f"/api/orders/{client_order.id}/comments/{client_comment['id']}"
        )
        assert response.status_code == 200

    def test_unknown_comment_is_404(self, api_client, client_order):
        response = api_client.delete(
            f"/api/orders/{client_order.id}/comments/999999"
        )
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/orders/<id>/documents (upload anexado ao pedido)
# ---------------------------------------------------------------------------


def _pdf_upload():
    return {"documents": (io.BytesIO(PDF_HEADER), "anexo.pdf")}


class TestUploadOrderDocuments:
    def test_client_uploads_to_own_order(self, api_client, client_order, upload_dir):
        # O pedido precisa ter petition vinculada — factory já cria
        response = api_client.post(
            f"/api/orders/{client_order.id}/documents",
            data=_pdf_upload(),
            content_type="multipart/form-data",
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert len(body["documents"]) == 1
        # Arquivo gravado em UPLOAD_FOLDER
        assert list(upload_dir.iterdir()), "Arquivo físico precisa estar gravado"

    def test_client_cannot_upload_to_other_clients_order(self, api, db, client_order):
        from tests.factories import create_client

        intruder = create_client(email="z@y.com")
        db.session.commit()

        response = api(intruder).post(
            f"/api/orders/{client_order.id}/documents",
            data=_pdf_upload(),
            content_type="multipart/form-data",
        )
        assert response.status_code == 403

    def test_cannot_upload_to_canceled_order(self, api_client, db, client_order):
        client_order.status = "cancelado"
        db.session.commit()
        response = api_client.post(
            f"/api/orders/{client_order.id}/documents",
            data=_pdf_upload(),
            content_type="multipart/form-data",
        )
        assert response.status_code == 400

    def test_invalid_extension_400(self, api_client, client_order):
        response = api_client.post(
            f"/api/orders/{client_order.id}/documents",
            data={"documents": (io.BytesIO(b"#!/bin/sh\n"), "evil.sh")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 400

    def test_no_files_400(self, api_client, client_order):
        response = api_client.post(
            f"/api/orders/{client_order.id}/documents",
            data={},
            content_type="multipart/form-data",
        )
        assert response.status_code == 400

    def test_staff_can_upload_to_any_order(self, api_staff, client_order):
        response = api_staff.post(
            f"/api/orders/{client_order.id}/documents",
            data=_pdf_upload(),
            content_type="multipart/form-data",
        )
        assert response.status_code == 201
