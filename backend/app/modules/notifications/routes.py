from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.core.rate_limit import limit_requests
from app.permissions import auth_required
from app.services.email_service import send_email

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api")

# Events accepted from the frontend (orderEmailNotify.ts).
_VALID_EVENTS = {"pedido_criado", "comentario_publicado"}


@notifications_bp.post("/notify-email")
@auth_required
@limit_requests("notify-email")
def notify_email():
    """Receive an order-related email notification from the frontend and
    relay it to the platform's configured notification address.

    The recipient is always overridden by the backend's NOTIFICATION_EMAIL —
    the frontend-supplied ``to`` field is intentionally ignored to prevent
    open-relay abuse.

    Request body (JSON):
        event   : "pedido_criado" | "comentario_publicado"
        subject : e-mail subject line
        body    : plain-text e-mail body
        to      : ignored — backend uses NOTIFICATION_EMAIL

    Response 200:
        { "delivered": true | false }
        delivered=false means either SMTP is not configured (dry-run) or
        sending failed; the frontend queues the entry for later audit.

    Response 400:
        { "error": "INVALID_EVENT" | "MISSING_FIELDS", "message": "..." }
    """
    data = request.get_json(silent=True) or {}
    event = data.get("event", "")
    subject = (data.get("subject") or "").strip()
    body = (data.get("body") or "").strip()

    if event not in _VALID_EVENTS:
        return (
            jsonify({"error": "INVALID_EVENT", "message": "Tipo de evento inválido."}),
            400,
        )

    if not subject or not body:
        return (
            jsonify(
                {
                    "error": "MISSING_FIELDS",
                    "message": "Os campos subject e body são obrigatórios.",
                }
            ),
            400,
        )

    to = current_app.config.get("NOTIFICATION_EMAIL", "")
    if not to:
        # NOTIFICATION_EMAIL not configured — silently acknowledge so the
        # frontend does not retry indefinitely.
        return jsonify({"delivered": False, "reason": "NOTIFICATION_EMAIL não configurado."}), 200

    delivered = send_email(to=to, subject=subject, body=body)
    return jsonify({"delivered": delivered}), 200
