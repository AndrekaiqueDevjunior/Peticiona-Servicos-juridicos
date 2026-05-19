from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import current_actor, roles_required
from app.services.client_area_service import (
    attach_order_documents,
    cancel_order,
    create_order,
    delete_document,
    get_catalog,
    get_order,
    list_orders,
    preview_cart,
    preview_service_request,
    update_order,
    upload_documents,
)
from app.services.checkout_service import (
    cancel_user_checkout_order,
    get_user_checkout_order,
    list_checkout_orders,
    update_user_checkout_order,
)

client_area_bp = Blueprint("client_area", __name__, url_prefix="/api/client-area")


@client_area_bp.get("")
def catalog():
    return jsonify(get_catalog())


@client_area_bp.post("/cart/preview")
def cart_preview():
    return jsonify(preview_cart(request.get_json(silent=True) or {}))


@client_area_bp.post("/orders")
@roles_required("client")
def create_client_order():
    actor = current_actor()
    payload, status = create_order(request.get_json(silent=True) or {}, user=actor)
    return jsonify(payload), status


@client_area_bp.get("/orders")
@roles_required("client")
def list_client_orders():
    return jsonify(list_orders(current_actor()))


@client_area_bp.get("/checkout-orders")
@roles_required("client")
def list_client_checkout_orders():
    return jsonify(list_checkout_orders(current_actor()))


@client_area_bp.get("/checkout-orders/<int:order_id>")
@roles_required("client")
def get_client_checkout_order(order_id: int):
    return jsonify(get_user_checkout_order(current_actor(), order_id))


@client_area_bp.put("/checkout-orders/<int:order_id>")
@client_area_bp.patch("/checkout-orders/<int:order_id>")
@roles_required("client")
def update_client_checkout_order(order_id: int):
    return jsonify(
        update_user_checkout_order(current_actor(), order_id, request.get_json(silent=True) or {})
    )


@client_area_bp.delete("/checkout-orders/<int:order_id>")
@roles_required("client")
def delete_client_checkout_order(order_id: int):
    return jsonify(cancel_user_checkout_order(current_actor(), order_id))


@client_area_bp.post("/orders/preview")
@roles_required("client")
def preview_client_order():
    return jsonify(preview_service_request(request.get_json(silent=True) or {}))


@client_area_bp.get("/orders/<int:order_id>")
@roles_required("client")
def client_order_detail(order_id: int):
    return jsonify(get_order(current_actor(), order_id))


@client_area_bp.put("/orders/<int:order_id>")
@client_area_bp.patch("/orders/<int:order_id>")
@roles_required("client")
def update_client_order(order_id: int):
    return jsonify(update_order(current_actor(), order_id, request.get_json(silent=True) or {}))


@client_area_bp.delete("/orders/<int:order_id>")
@roles_required("client")
def delete_client_order(order_id: int):
    return jsonify(cancel_order(current_actor(), order_id))


@client_area_bp.post("/documents")
@roles_required("client")
def upload_client_documents():
    actor = current_actor()
    payload, status = upload_documents(actor, request.files.getlist("documents"))
    return jsonify(payload), status


@client_area_bp.post("/orders/<int:order_id>/documents")
@roles_required("client")
def attach_client_order_documents(order_id: int):
    actor = current_actor()
    payload, status = attach_order_documents(
        actor, order_id, request.files.getlist("documents")
    )
    return jsonify(payload), status


@client_area_bp.delete("/documents/<int:document_id>")
@roles_required("client")
def delete_client_document(document_id: int):
    return jsonify(delete_document(current_actor(), document_id))
