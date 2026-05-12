from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.core.rate_limit import limit_requests
from app.services.checkout_service import process_pagarme_webhook
from app.services.pagarme_service import require_webhook_token, verify_webhook_signature

webhooks_bp = Blueprint("webhooks", __name__, url_prefix="/api/webhooks")


@webhooks_bp.post("/pagarme")
@limit_requests("webhook-pagarme", limit=60, window=60)
def pagarme():
    raw_body = request.get_data(cache=True)
    signature = (
        request.headers.get("X-Hub-Signature-256")
        or request.headers.get("X-Hub-Signature")
        or request.headers.get("X-PagarMe-Signature")
        or request.headers.get("Pagarme-Signature")
    )
    # token apenas via header — nunca via query param (evita leakage em logs)
    token = request.headers.get("X-Pagarme-Webhook-Token")
    if signature:
        verify_webhook_signature(raw_body, signature)
    else:
        require_webhook_token(token)
    payload = request.get_json(silent=True) or {}
    return jsonify(process_pagarme_webhook(payload, raw_body=raw_body))
