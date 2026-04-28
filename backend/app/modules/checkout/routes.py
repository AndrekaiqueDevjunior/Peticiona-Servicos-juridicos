from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.core.rate_limit import limit_requests
from app.permissions import auth_required, current_actor
from app.services.checkout_service import (
    create_checkout_order,
    create_checkout_payment,
    get_checkout_status,
)

checkout_bp = Blueprint("checkout", __name__, url_prefix="/api/checkout")


@checkout_bp.post("/create-order")
@auth_required
@limit_requests("checkout-create-order")
def create_order():
    payload, status = create_checkout_order(current_actor(), request.get_json(silent=True) or {})
    return jsonify(payload), status


@checkout_bp.post("/create-payment")
@auth_required
@limit_requests("checkout-create-payment")
def create_payment():
    payload, status = create_checkout_payment(
        current_actor(),
        request.get_json(silent=True) or {},
        client_ip=_client_ip(),
    )
    return jsonify(payload), status


@checkout_bp.get("/status/<int:order_id>")
@auth_required
def status(order_id: int):
    return jsonify(get_checkout_status(current_actor(), order_id))


def _client_ip() -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None
    return request.remote_addr
