from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging

from flask import Blueprint, jsonify, request

from app.core.errors import ValidationError
from app.core.extensions import db
from app.core.rate_limit import limit_requests
from app.models.email_event import EmailEvent
from app.services.checkout_service import process_pagarme_webhook as process_checkout_pagarme_webhook
from app.services.credit_payment_service import (
    process_pagarme_webhook as process_credit_purchase_pagarme_webhook,
)
from app.services.pagarme_service import require_webhook_token, verify_webhook_signature

logger = logging.getLogger(__name__)

webhooks_bp = Blueprint("webhooks", __name__, url_prefix="/api/webhooks")


def _verify_resend_signature(
    secret: str, raw_body: bytes, msg_id: str, timestamp: str, signatures: str
) -> bool:
    """Valida assinatura svix usada pelo Resend.

    Docs: https://docs.resend.com/changelog/webhooks
    Formato de assinatura: HMAC-SHA256 sobre '{msg_id}.{timestamp}.{raw_body}',
    codificado em base64. O segredo pode vir com prefixo 'whsec_'.
    """
    if not secret or not msg_id or not timestamp or not signatures:
        return False

    key_str = secret.removeprefix("whsec_")
    try:
        key_bytes = base64.b64decode(key_str)
    except Exception:
        logger.error("RESEND_WEBHOOK_SECRET inválido (não é base64 válido).")
        return False

    try:
        signed_content = f"{msg_id}.{timestamp}.".encode("utf-8") + raw_body
    except Exception:
        return False

    computed = hmac.new(key_bytes, signed_content, hashlib.sha256).digest()
    computed_b64 = base64.b64encode(computed).decode("ascii")

    for entry in signatures.split():
        _, _, sig = entry.partition(",")
        if sig and hmac.compare_digest(sig, computed_b64):
            return True
    return False


@webhooks_bp.post("/pagarme")
@limit_requests("webhook-pagarme", limit=60, window=60)
def pagarme():
    raw_body = request.get_data(cache=True)
    
    # Em produção, assinatura HMAC é obrigatória para segurança.
    # Default DEBUG=False (fail-secure): se a flag não estiver setada
    # explicitamente, assumimos prod e exigimos HMAC. Antes o default
    # era True, então uma config esquecida em prod abria janela para
    # webhook sem assinatura (só com token).
    from flask import current_app
    is_production = current_app.config.get("ENV") == "production" or not current_app.config.get("DEBUG", False)

    signature = (
        request.headers.get("X-Hub-Signature-256")
        or request.headers.get("X-Hub-Signature")
        or request.headers.get("X-PagarMe-Signature")
        or request.headers.get("Pagarme-Signature")
    )

    logger.info(
        "webhook_pagarme_received method=%s has_signature=%s content_length=%s",
        request.method,
        bool(signature),
        request.content_length,
    )

    if is_production:
        if not signature:
            logger.warning(
                "webhook_pagarme_rejected_no_signature headers=%s",
                dict(request.headers),
            )
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
    checkout_result = process_checkout_pagarme_webhook(payload, raw_body=raw_body)
    credit_purchase_result = process_credit_purchase_pagarme_webhook(payload)

    response = dict(checkout_result)
    response["credit_purchase"] = credit_purchase_result
    response["processed"] = bool(
        checkout_result.get("processed") or credit_purchase_result.get("matched")
    )
    if credit_purchase_result.get("matched") and not response.get("status"):
        response["status"] = credit_purchase_result.get("status")
    return jsonify(response)


@webhooks_bp.post("/resend")
@limit_requests("webhook-resend", limit=120, window=60)
def resend_webhook():
    """Recebe eventos do Resend (email.sent, email.delivered, email.bounced, etc.).

    Validação de assinatura: HMAC-SHA256 via svix (obrigatório se RESEND_WEBHOOK_SECRET
    estiver configurado). Eventos são registrados na tabela email_events com idempotência
    por event_id.
    """
    from flask import current_app

    raw_body = request.get_data(cache=True)
    secret = (current_app.config.get("RESEND_WEBHOOK_SECRET") or "").strip()

    if secret:
        msg_id = request.headers.get("svix-id", "")
        timestamp = request.headers.get("svix-timestamp", "")
        signatures = request.headers.get("svix-signature", "")

        if not _verify_resend_signature(secret, raw_body, msg_id, timestamp, signatures):
            logger.warning(
                "Webhook Resend rejeitado: assinatura inválida. msg_id=%s", msg_id
            )
            raise ValidationError("Assinatura do webhook inválida.")
    else:
        logger.warning(
            "RESEND_WEBHOOK_SECRET não configurado — webhook aceito sem validação de assinatura."
        )

    try:
        payload = json.loads(raw_body) if raw_body else {}
    except Exception:
        payload = {}

    event_id = (
        request.headers.get("svix-id")
        or (payload.get("data") or {}).get("email_id")
        or None
    )
    event_type = str(payload.get("type") or "unknown")

    if event_id:
        existing = db.session.execute(
            db.select(EmailEvent).where(EmailEvent.event_id == event_id)
        ).scalar_one_or_none()
        if existing:
            logger.info("Webhook Resend duplicado ignorado: event_id=%s", event_id)
            return jsonify({"ok": True, "duplicate": True})

    data = payload.get("data") or {}
    recipient = data.get("to") or (data.get("to_emails") or [None])[0]
    subject = data.get("subject")
    status = data.get("status") or event_type

    try:
        event = EmailEvent(
            provider="resend",
            event_id=event_id,
            event_type=event_type,
            recipient=str(recipient) if recipient else None,
            subject=str(subject)[:500] if subject else None,
            status=str(status)[:40] if status else None,
            payload_json=json.dumps(payload, ensure_ascii=False)[:8000],
        )
        db.session.add(event)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception(
            "Falha ao registrar evento Resend no banco. event_type=%s event_id=%s",
            event_type,
            event_id,
        )

    logger.info(
        "Webhook Resend processado: type=%s recipient=%s event_id=%s",
        event_type,
        recipient,
        event_id,
    )
    return jsonify({"ok": True})
