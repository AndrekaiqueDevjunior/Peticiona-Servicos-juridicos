from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.permissions import auth_required, current_actor
from app.services.client_area_service import create_order, get_catalog, list_orders, preview_cart, upload_documents

client_area_bp = Blueprint("client_area", __name__, url_prefix="/api/client-area")


@client_area_bp.get("")
def catalog():
    return jsonify(get_catalog())


@client_area_bp.post("/cart/preview")
def cart_preview():
    return jsonify(preview_cart(request.get_json(silent=True) or {}))


@client_area_bp.post("/orders")
@auth_required
def create_client_order():
    actor = current_actor()
    payload, status = create_order(request.get_json(silent=True) or {}, user=actor)
    return jsonify(payload), status


@client_area_bp.get("/orders")
@auth_required
def list_client_orders():
    return jsonify(list_orders(current_actor()))


@client_area_bp.post("/documents")
@auth_required
def upload_client_documents():
    actor = current_actor()
    payload, status = upload_documents(actor, request.files.getlist("documents"))
    return jsonify(payload), status
