from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.core.rate_limit import limit_requests
from app.services.contact_service import process_contact

contact_bp = Blueprint("contact", __name__, url_prefix="/api")


@contact_bp.post("/contact")
@limit_requests("contact-form", limit=5, window=300)
def contact():
    """Recebe o formulário de contato do site e envia e-mail via Resend."""
    payload = request.get_json(silent=True) or {}
    return jsonify(process_contact(payload))
