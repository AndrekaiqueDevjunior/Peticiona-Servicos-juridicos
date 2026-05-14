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
    
    # Em produção, assinatura HMAC é obrigatória para segurança
    from flask import current_app
    is_production = current_app.config.get("ENV") == "production" or not current_app.config.get("DEBUG", True)
    
    signature = (
        request.headers.get("X-Hub-Signature-256")
        or request.headers.get("X-Hub-Signature")
        or request.headers.get("X-PagarMe-Signature")
        or request.headers.get("Pagarme-Signature")
    )
    
    if is_production:
        if not signature:
            from app.core.errors import ValidationError
            raise ValidationError("Assinatura do webhook obrigatória em produção")
        verify_webhook_signature(raw_body, signature)
    else:
        # Em desenvolvimento, permite token como fallback
        token = request.headers.get("X-Pagarme-Webhook-Token")
        if signature:
            verify_webhook_signature(raw_body, signature)
        else:
            require_webhook_token(token)
    
    payload = request.get_json(silent=True) or {}
    return jsonify(process_pagarme_webhook(payload, raw_body=raw_body))
