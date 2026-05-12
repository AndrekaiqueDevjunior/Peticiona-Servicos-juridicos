from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.core.rate_limit import limit_requests
from app.permissions import auth_required
from app.services.email_service import send_email

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api")

_VALID_EVENTS = {"pedido_criado", "comentario_publicado"}


@notifications_bp.post("/notify-email")
@auth_required
@limit_requests("notify-email", limit=30, window=60)
def notify_email():
    """Relay order-related notifications to the configured platform inbox."""

    data = request.get_json(silent=True) or {}
    event = str(data.get("event") or "").strip()
    subject = str(data.get("subject") or "").strip()
    body = str(data.get("body") or "").strip()

    if event not in _VALID_EVENTS:
        return jsonify({"error": "INVALID_EVENT", "message": "Tipo de evento inválido."}), 400

    if not subject or not body:
        return jsonify({"error": "MISSING_FIELDS", "message": "Os campos subject e body são obrigatórios."}), 400

    target = current_app.config.get("NOTIFICATION_EMAIL", "").strip()
    if not target:
        return jsonify({"delivered": False, "reason": "NOTIFICATION_EMAIL não configurado."}), 202

    delivered = send_email(to=target, subject=subject, body=body)
    return jsonify({"delivered": delivered}), 200
