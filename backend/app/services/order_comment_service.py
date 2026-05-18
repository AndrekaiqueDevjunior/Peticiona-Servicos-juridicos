from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from flask import current_app
from sqlalchemy import text

from app.core.errors import NotFoundError, PermissionDenied, ValidationError
from app.core.extensions import db
from app.core.security import ensure_allowed_document, ensure_upload_size, upload_folder
from app.models import Document, PetitionDocumentLink, ServiceOrder
from app.services.audit_service import log_action
from app.services.serializers import serialize_document


def _get_order(order_id: int, actor) -> ServiceOrder:
    order = db.session.get(ServiceOrder, order_id)
    if not order:
        raise NotFoundError("Pedido não encontrado.")
    if getattr(actor, "role", None) == "client" and order.user_id != actor.id:
        raise PermissionDenied("Acesso negado ao pedido.")
    return order


def _serialize_comment(row) -> dict:
    created_at = row.created_at
    return {
        "id": row.id,
        "order_id": row.order_id,
        "author_id": row.author_id,
        "author_name": row.author_name,
        "author_role": row.author_role,
        "text": row.text,
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
    }


def list_comments(order_id: int, actor) -> list[dict]:
    _get_order(order_id, actor)
    rows = db.session.execute(
        text("SELECT * FROM order_comments WHERE order_id = :oid ORDER BY created_at ASC"),
        {"oid": order_id},
    ).fetchall()
    return [_serialize_comment(r) for r in rows]


def add_comment(order_id: int, actor, payload: dict) -> dict:
    _get_order(order_id, actor)
    text_content = (payload.get("text") or "").strip()
    if not text_content:
        raise ValidationError("Comentário não pode ser vazio.")
    if len(text_content) > 5000:
        raise ValidationError("Comentário muito longo (máx. 5000 caracteres).")
    db.session.execute(
        text("""
            INSERT INTO order_comments (order_id, author_id, author_name, author_role, text, created_at)
            VALUES (:oid, :aid, :aname, :arole, :txt, :created_at)
        """),
        {
            "oid": order_id,
            "aid": actor.id,
            "aname": actor.full_name,
            "arole": actor.role,
            "txt": text_content,
            "created_at": datetime.now(timezone.utc),
        },
    )
    log_action(
        action="order.comment_added",
        entity_type="service_order",
        entity_id=order_id,
        user=actor,
        metadata={"role": actor.role},
    )
    db.session.commit()
    row = db.session.execute(
        text("SELECT * FROM order_comments WHERE order_id = :oid ORDER BY created_at DESC LIMIT 1"),
        {"oid": order_id},
    ).fetchone()
    return _serialize_comment(row)


def delete_comment(order_id: int, comment_id: int, actor) -> dict:
    _get_order(order_id, actor)
    row = db.session.execute(
        text("SELECT * FROM order_comments WHERE id = :cid AND order_id = :oid"),
        {"cid": comment_id, "oid": order_id},
    ).fetchone()
    if not row:
        raise NotFoundError("Comentário não encontrado.")
    if actor.role not in ("admin",) and row.author_id != actor.id:
        from app.core.errors import PermissionDenied
        raise PermissionDenied("Sem permissão para excluir este comentário.")
    db.session.execute(
        text("DELETE FROM order_comments WHERE id = :cid"),
        {"cid": comment_id},
    )
    db.session.commit()
    return {"deleted": True}


def upload_order_document(order_id: int, actor, files) -> list[dict]:
    order = _get_order(order_id, actor)
    if not files:
        raise ValidationError("Envie ao menos um arquivo.")
    folder = upload_folder()
    created = []
    for file_storage in files:
        filename = ensure_allowed_document(file_storage.filename or "")
        content = file_storage.read()
        ensure_upload_size(len(content))
        suffix = Path(filename).suffix.lower()
        stored_name = f"{uuid4().hex}{suffix}"
        (folder / stored_name).write_bytes(content)
        doc = Document(
            user_id=actor.id,
            company_id=getattr(actor, "company_id", None),
            file_name=filename,
            stored_name=stored_name,
            mime_type=file_storage.mimetype,
            size_bytes=len(content),
        )
        db.session.add(doc)
        db.session.flush()
        # Link document to petition if order has one
        if order.petition_id:
            db.session.add(
                PetitionDocumentLink(
                    petition_id=order.petition_id,
                    document_id=doc.id,
                    company_id=order.company_id or getattr(actor, "company_id", None),
                )
            )
        created.append(doc)
    log_action(
        action="order.document_uploaded",
        entity_type="service_order",
        entity_id=order_id,
        user=actor,
        metadata={"count": len(created)},
    )
    db.session.commit()
    return [serialize_document(d) for d in created]
