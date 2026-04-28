from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.core.errors import AuthError
from app.services.checkout_service import process_pagarme_webhook
from app.services.pagarme_service import require_webhook_token, verify_webhook_signature

webhooks_bp = Blueprint("webhooks", __name__, url_prefix="/api/webhooks")


@webhooks_bp.post("/pagarme")
def pagarme():
    raw_body = request.get_data(cache=True)

    # 1. Static bearer token (PAGARME_WEBHOOK_TOKEN) — first line of defence
    #    so forged requests are rejected before HMAC computation.
    auth = request.headers.get("Authorization", "")
    bearer = auth.removeprefix("Bearer ").strip() if auth.startswith("Bearer ") else ""
    require_webhook_token(bearer or None)

    # 2. HMAC-SHA1 signature over the raw body using PAGARME_SECRET_KEY.
    try:
        verify_webhook_signature(raw_body, request.headers.get("X-Hub-Signature"))
    except AuthError:
        current_app.logger.warning("checkout.webhook_invalid_signature")
        raise

    payload = request.get_json(silent=True) or {}
    return jsonify(process_pagarme_webhook(payload, raw_body=raw_body))
