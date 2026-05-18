from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.core.extensions import db
from app.permissions import auth_required, current_actor, roles_required
from app.services.order_comment_service import (
    add_comment,
    delete_comment,
    list_comments,
    upload_order_document,
)

comments_bp = Blueprint("comments", __name__, url_prefix="/api/orders")


@comments_bp.get("/<int:order_id>/comments")
@auth_required
def get_comments(order_id: int):
    actor = current_actor()
    return jsonify({"comments": list_comments(order_id, actor)})


@comments_bp.post("/<int:order_id>/comments")
@auth_required
def post_comment(order_id: int):
    actor = current_actor()
    comment = add_comment(order_id, actor, request.get_json(silent=True) or {})
    return jsonify({"comment": comment}), 201


@comments_bp.delete("/<int:order_id>/comments/<int:comment_id>")
@auth_required
def remove_comment(order_id: int, comment_id: int):
    actor = current_actor()
    return jsonify(delete_comment(order_id, comment_id, actor))


@comments_bp.post("/<int:order_id>/documents")
@auth_required
def upload_documents(order_id: int):
    from app.core.errors import PermissionDenied
    from app.models import ServiceOrder
    actor = current_actor()
    # Clients can only upload to their own orders; admin/staff can upload to any
    if actor.role == "client":
        order = db.session.get(ServiceOrder, order_id)
        if not order or order.user_id != actor.id:
            raise PermissionDenied("Acesso negado ao pedido.")
        if order.status == "cancelado":
            from app.core.errors import ValidationError
            raise ValidationError("Não é possível anexar documentos a pedidos cancelados.")
    files = request.files.getlist("documents")
    docs = upload_order_document(order_id, actor, files)
    return jsonify({"documents": docs}), 201
