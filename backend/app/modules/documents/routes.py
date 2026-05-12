from __future__ import annotations

from flask import Blueprint, send_from_directory
from sqlalchemy import text

from app.core.errors import NotFoundError, PermissionDenied
from app.core.extensions import db
from app.core.security import upload_folder
from app.models import Document
from app.permissions import auth_required, current_actor

documents_bp = Blueprint("documents", __name__, url_prefix="/api/documents")


@documents_bp.get("/<int:document_id>/download")
@auth_required
def download_document(document_id: int):
    actor = current_actor()
    doc = Document.query.get(document_id)
    if not doc:
        raise NotFoundError("Documento não encontrado.")
    if actor.role not in ("admin", "staff"):
        # Allow if actor uploaded the document
        if doc.user_id != actor.id:
            # Also allow if the document belongs to an order the actor owns
            linked = db.session.execute(
                text("""
                    SELECT so.id FROM petition_document_links pdl
                    JOIN petitions p ON p.id = pdl.petition_id
                    JOIN service_orders so ON so.petition_id = p.id
                    WHERE pdl.document_id = :did AND so.user_id = :uid
                    LIMIT 1
                """),
                {"did": document_id, "uid": actor.id},
            ).fetchone()
            if not linked:
                raise PermissionDenied("Acesso negado ao documento.")
    folder = upload_folder()
    if not (folder / doc.stored_name).exists():
        raise NotFoundError("Arquivo não encontrado no servidor.")
    return send_from_directory(
        folder,
        doc.stored_name,
        as_attachment=True,
        download_name=doc.file_name,
        mimetype=doc.mime_type or "application/octet-stream",
    )
