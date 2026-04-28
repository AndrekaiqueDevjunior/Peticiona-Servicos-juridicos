from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.core.errors import AuthError
from app.core.rate_limit import limit_requests
from app.permissions import auth_required, current_actor
from app.services.credit_payment_service import (
    create_credit_purchase,
    get_credit_payment_config,
    process_pagarme_webhook,
)
from app.services.pagarme_service import verify_webhook_signature

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")


@payments_bp.get("/credit-packages")
@auth_required
def credit_packages():
    return jsonify(get_credit_payment_config())


@payments_bp.post("/credit-orders")
@auth_required
@limit_requests("credit-orders")
def credit_orders():
    payload = request.get_json(silent=True) or {}
    response = create_credit_purchase(
        current_actor(),
        payload,
        client_ip=_client_ip(),
    )
    return jsonify(response), 201


@payments_bp.post("/pagarme/webhook")
def pagarme_webhook():
    raw_body = request.get_data(cache=True)
    _require_webhook_token()
    verify_webhook_signature(raw_body, request.headers.get("X-Hub-Signature"))
    return jsonify(process_pagarme_webhook(request.get_json(silent=True) or {}))


def _client_ip() -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None
    return request.remote_addr


def _require_webhook_token() -> None:
    expected = current_app.config.get("PAGARME_WEBHOOK_TOKEN")
    if not expected:
        return
    auth = request.headers.get("Authorization", "")
    bearer = auth.removeprefix("Bearer ").strip() if auth.startswith("Bearer ") else ""
    header_token = request.headers.get("X-Webhook-Token", "").strip()
    if expected not in {bearer, header_token}:
        raise AuthError("Webhook não autorizado.")
