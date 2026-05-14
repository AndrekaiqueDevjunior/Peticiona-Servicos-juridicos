from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from flask import current_app

from app.core.errors import AppError, ValidationError
from app.services.email_service import (
    build_contact_admin_html,
    build_contact_confirmation_html,
    send_email,
)

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^[0-9()+\-\s]{8,20}$")


class ContactDeliveryError(AppError):
    status_code = 503


def _validate_contact_payload(payload: dict) -> dict:
    name = str(payload.get("name") or "").strip()
    whatsapp = str(payload.get("whatsapp") or "").strip()
    email = str(payload.get("email") or "").strip()
    message = str(payload.get("message") or "").strip()

    if not name or len(name) < 2:
        raise ValidationError("Informe seu nome (mínimo 2 caracteres).")
    if len(name) > 100:
        raise ValidationError("Nome muito longo.")

    if not whatsapp:
        raise ValidationError("Informe seu WhatsApp.")
    if not _PHONE_RE.match(whatsapp):
        raise ValidationError("WhatsApp inválido. Use apenas números e os símbolos + ( ) -.")

    if not email:
        raise ValidationError("Informe seu e-mail.")
    if not _EMAIL_RE.match(email) or len(email) > 255:
        raise ValidationError("E-mail inválido.")

    if not message or len(message) < 5:
        raise ValidationError("Escreva uma mensagem (mínimo 5 caracteres).")
    if len(message) > 1000:
        raise ValidationError("Mensagem muito longa (máximo 1000 caracteres).")

    return {"name": name, "whatsapp": whatsapp, "email": email, "message": message}


def _admin_email() -> str:
    return (
        current_app.config.get("RESEND_CONTACT_TO_EMAIL", "").strip()
        or current_app.config.get("NOTIFICATION_EMAIL", "").strip()
    )


def process_contact(payload: dict) -> dict:
    data = _validate_contact_payload(payload)

    received_at = datetime.now(timezone.utc).strftime("%d/%m/%Y às %H:%M UTC")

    admin_to = _admin_email()
    if not admin_to:
        logger.error(
            "RESEND_CONTACT_TO_EMAIL / NOTIFICATION_EMAIL não configurado — "
            "contato de %s não pôde ser entregue ao admin.",
            data["email"],
        )
        raise ContactDeliveryError(
            "Não foi possível enviar a mensagem agora. Tente novamente em breve."
        )

    plain_body = (
        f"Nova mensagem de contato:\n\n"
        f"Nome: {data['name']}\n"
        f"WhatsApp: {data['whatsapp']}\n"
        f"E-mail: {data['email']}\n"
        f"Recebido em: {received_at}\n\n"
        f"Mensagem:\n{data['message']}\n"
    )
    admin_html = build_contact_admin_html(
        name=data["name"],
        whatsapp=data["whatsapp"],
        email=data["email"],
        message=data["message"],
        received_at=received_at,
    )

    admin_sent = send_email(
        to=admin_to,
        subject=f"Nova mensagem recebida pelo site Peticiona — {data['name']}",
        body=plain_body,
        html=admin_html,
    )
    if not admin_sent:
        logger.error(
            "Falha ao entregar e-mail de contato ao admin (%s). Remetente: %s",
            admin_to,
            data["email"],
        )
        raise ContactDeliveryError(
            "Não foi possível enviar a mensagem agora. Tente novamente em breve."
        )

    logger.info(
        "Formulário de contato recebido: nome=%s whatsapp=%s email=%s",
        data["name"],
        data["whatsapp"],
        data["email"],
    )

    confirm_body = (
        f"Olá, {data['name']}!\n\n"
        "Recebemos sua mensagem e nossa equipe entrará em contato em breve.\n"
        "Horário de atendimento: segunda a sexta, das 9h às 18h.\n"
    )
    try:
        send_email(
            to=data["email"],
            subject="Recebemos sua mensagem — Peticiona",
            body=confirm_body,
            html=build_contact_confirmation_html(name=data["name"]),
        )
    except Exception:
        logger.warning(
            "Confirmação de contato não entregue ao usuário %s (não crítico).",
            data["email"],
        )

    return {"message": "Mensagem enviada com sucesso."}
