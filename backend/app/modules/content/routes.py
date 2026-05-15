from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.services.content_service import (
    get_catalog_item,
    get_full_catalog,
    get_home_content,
    get_plans_catalog,
    get_public_catalog,
)
from app.services.settings_service import get_contact_info
from app.services.email_service import send_email

content_bp = Blueprint("content", __name__, url_prefix="/api")


@content_bp.get("/home")
def home():
    return jsonify(get_home_content())


@content_bp.get("/plans")
def plans():
    return jsonify(get_plans_catalog())


@content_bp.get("/catalog")
def catalog():
    """Catálogo unificado: planos + serviços avulsos.

    Mantém compatibilidade retornando também `catalog` (formato antigo
    de seções) para clientes legados; a fonte canônica passa a ser
    `plans` e `services` (planos completos do banco)."""
    full = get_full_catalog()
    legacy = get_public_catalog()
    payload = dict(full)
    payload["catalog"] = legacy.get("catalog", [])
    return jsonify(payload)


@content_bp.get("/catalog/<string:code>")
def catalog_item(code: str):
    return jsonify(get_catalog_item(code))


@content_bp.get("/contact-info")
def contact_info():
    return jsonify(get_contact_info())


@content_bp.post("/contact-requests")
def contact_request():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip()
    whatsapp = str(data.get("whatsapp") or "").strip()
    message = str(data.get("message") or "").strip()

    if not name or not email or not message:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Nome, e-mail e mensagem são obrigatórios."}), 400

    contact = get_contact_info()
    target = current_app.config.get("NOTIFICATION_EMAIL") or contact["email"]
    subject = f"[Peticiona] Contato pelo site - {name}"
    body = "\n".join(
        [
            "Nova mensagem enviada pelo site Peticiona.",
            "",
            f"Nome: {name}",
            f"E-mail: {email}",
            f"WhatsApp: {whatsapp or '-'}",
            "",
            "Mensagem:",
            message,
        ]
    )
    delivered = send_email(to=target, subject=subject, body=body)
    return jsonify({"message": "Solicitação recebida.", "delivered": delivered})
