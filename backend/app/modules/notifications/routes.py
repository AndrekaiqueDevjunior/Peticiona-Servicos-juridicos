from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.core.rate_limit import limit_requests
from app.core.extensions import db
from app.models import PaymentEvent
from app.models.email_event import EmailEvent
from app.permissions import auth_required, roles_required
from app.services.email_service import send_email

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api")

_VALID_EVENTS = {"pedido_criado", "comentario_publicado"}


def _payment_notification(event: PaymentEvent) -> dict:
    payload = event.payload_json if isinstance(event.payload_json, dict) else {}
    status = str(payload.get("status") or event.event_type or "").lower()
    order_ref = f"Pedido #{event.order_id}" if event.order_id else "Pagamento"
    severity = "info"
    title = "Evento de pagamento recebido"
    if status in {"paid", "captured"} or "paid" in event.event_type:
        title = "Pagamento confirmado"
        severity = "success"
    elif status in {"failed", "refused", "declined", "canceled", "refunded"}:
        title = "Atenção no pagamento"
        severity = "danger"
    elif status in {"processing", "pending"}:
        title = "Pagamento em processamento"
        severity = "warning"

    return {
        "id": f"payment:{event.id}",
        "source": "pagarme",
        "kind": "payment",
        "severity": severity,
        "title": title,
        "description": f"{order_ref} · {event.event_type}",
        "created_at": event.created_at.isoformat(),
        "event_type": event.event_type,
        "metadata": {
            "order_id": event.order_id,
            "gateway_event_id": event.gateway_event_id,
            "status": status or None,
        },
    }


def _email_notification(event: EmailEvent) -> dict:
    event_type = str(event.event_type or "unknown")
    lower = event_type.lower()
    severity = "info"
    title = "Evento de e-mail recebido"
    if any(token in lower for token in ("delivered", "sent")):
        title = "E-mail entregue"
        severity = "success"
    elif any(token in lower for token in ("bounce", "complain", "failed", "delivery_delayed")):
        title = "Atenção no e-mail"
        severity = "danger"
    elif any(token in lower for token in ("opened", "clicked")):
        title = "Interação com e-mail"

    subject = event.subject or "Sem assunto"
    recipient = event.recipient or "destinatário não informado"
    return {
        "id": f"email:{event.id}",
        "source": "resend",
        "kind": "email",
        "severity": severity,
        "title": title,
        "description": f"{recipient} · {subject}",
        "created_at": event.created_at.isoformat(),
        "event_type": event_type,
        "metadata": {
            "recipient": event.recipient,
            "subject": event.subject,
            "status": event.status,
            "event_id": event.event_id,
        },
    }


@notifications_bp.get("/admin/notifications")
@roles_required("admin")
@limit_requests("admin-notifications", limit=120, window=60)
def admin_notifications():
    raw_limit = request.args.get("limit", "30")
    try:
        limit = min(max(int(raw_limit), 1), 100)
    except (TypeError, ValueError):
        limit = 30

    payment_events = (
        db.session.execute(
            db.select(PaymentEvent).order_by(PaymentEvent.created_at.desc()).limit(limit)
        )
        .scalars()
        .all()
    )
    email_events = (
        db.session.execute(
            db.select(EmailEvent).order_by(EmailEvent.created_at.desc()).limit(limit)
        )
        .scalars()
        .all()
    )
    notifications = [_payment_notification(e) for e in payment_events] + [
        _email_notification(e) for e in email_events
    ]
    notifications.sort(key=lambda item: item["created_at"], reverse=True)

    cfg = current_app.config
    return jsonify(
        {
            "notifications": notifications[:limit],
            "channels": {
                "pagarme_webhook_configured": bool((cfg.get("PAGARME_WEBHOOK_TOKEN") or "").strip()),
                "resend_webhook_configured": bool((cfg.get("RESEND_WEBHOOK_SECRET") or "").strip()),
                "notification_email_configured": bool((cfg.get("NOTIFICATION_EMAIL") or "").strip()),
            },
        }
    )


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
