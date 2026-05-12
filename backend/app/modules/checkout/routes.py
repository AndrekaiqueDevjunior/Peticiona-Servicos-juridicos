from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.core.rate_limit import limit_requests
from app.permissions import auth_required, current_actor
from app.services.checkout_service import create_checkout_order, create_checkout_payment, get_checkout_status

checkout_bp = Blueprint("checkout", __name__, url_prefix="/api/checkout")


def _client_ip() -> str | None:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr


@checkout_bp.get("/config")
def checkout_config():
    return jsonify({"public_key": current_app.config.get("PAGARME_PUBLIC_KEY", "")})


@checkout_bp.post("/create-order")
@auth_required
@limit_requests("checkout-create-order", limit=10, window=60)
def create_order():
    body, status_code = create_checkout_order(current_actor(), request.get_json(silent=True) or {})
    return jsonify(body), status_code


@checkout_bp.post("/create-payment")
@auth_required
@limit_requests("checkout-create-payment", limit=5, window=120)
def create_payment():
    body, status_code = create_checkout_payment(current_actor(), request.get_json(silent=True) or {}, client_ip=_client_ip())
    return jsonify(body), status_code


@checkout_bp.get("/status/<int:order_id>")
@auth_required
@limit_requests("checkout-status", limit=30, window=60)
def status(order_id: int):
    return jsonify(get_checkout_status(current_actor(), order_id))
