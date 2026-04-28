from __future__ import annotations

import re

from flask import Blueprint, jsonify, request

from app.core.errors import PermissionDenied, ValidationError
from app.core.rate_limit import limit_requests
from app.permissions import auth_required, current_actor
from app.services.credit_payment_service import (
    _billing_address_payload,
    _clean_card_token,
    create_credit_purchase,
    get_credit_payment_config,
    process_pagarme_webhook,
)
from app.services.pagarme_service import PagarmeClient, require_webhook_token, verify_webhook_signature

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")


@payments_bp.get("/credit-packages")
@auth_required
def credit_packages():
    return jsonify(get_credit_payment_config())


@payments_bp.post("/credit-orders")
@auth_required
@limit_requests("credit-orders")
def credit_orders():
    payload = request.get_json(silent=True) or {}
    response = create_credit_purchase(
        current_actor(),
        payload,
        client_ip=_client_ip(),
    )
    return jsonify(response), 201


@payments_bp.post("/pagarme/webhook")
def pagarme_webhook():
    raw_body = request.get_data(cache=True)
    auth = request.headers.get("Authorization", "")
    bearer = auth.removeprefix("Bearer ").strip() if auth.startswith("Bearer ") else ""
    header_token = request.headers.get("X-Webhook-Token", "").strip()
    require_webhook_token(bearer or header_token or None)
    verify_webhook_signature(raw_body, request.headers.get("X-Hub-Signature"))
    return jsonify(process_pagarme_webhook(request.get_json(silent=True) or {}))


@payments_bp.get("/smoke")
@auth_required
def smoke():
    """Verify Pagar.me connectivity. Restricted to admin and staff roles."""
    user = current_actor()
    if user.role not in {"admin", "staff"}:
        raise PermissionDenied("Acesso restrito a administradores.")
    return jsonify(PagarmeClient().smoke_test())


@payments_bp.post("/smoke-charge")
@auth_required
@limit_requests("smoke-charge")
def smoke_charge():
    """Create a R$ 1,00 test charge (card or PIX) to validate the Pagar.me integration.

    Request body:
        method          : "credit_card" | "pix"
        card_token      : string  (required for credit_card — tokenized on the frontend)
        customer.document : CPF or CNPJ digits
        customer.phone  : phone digits (DDD + number)
        billing_address : { street, number, neighborhood, city, state, zip_code }
                          (required for credit_card)
    """
    user = current_actor()
    if user.role not in {"admin", "staff"}:
        raise PermissionDenied("Acesso restrito a administradores.")

    data = request.get_json(silent=True) or {}
    method = str(data.get("method") or "pix").strip().lower()
    if method not in {"credit_card", "pix"}:
        raise ValidationError("Método inválido. Use 'credit_card' ou 'pix'.")

    card_token = None
    billing_address = None
    if method == "credit_card":
        card_token = _clean_card_token(data.get("card_token"))
        billing_payload = data.get("billing_address") if isinstance(data.get("billing_address"), dict) else {}
        billing_address = _billing_address_payload(billing_payload)

    customer_payload = data.get("customer") if isinstance(data.get("customer"), dict) else {}
    customer = _build_smoke_customer(user, customer_payload)
    result = PagarmeClient().smoke_charge(
        method=method,
        customer=customer,
        card_token=card_token,
        billing_address=billing_address,
    )
    return jsonify(result), 201


def _build_smoke_customer(user, extra: dict) -> dict:
    doc = re.sub(r"\D", "", str(extra.get("document") or ""))
    phone = re.sub(r"\D", "", str(extra.get("phone") or ""))
    if len(doc) not in {11, 14}:
        raise ValidationError("CPF ou CNPJ do pagador é obrigatório.")
    if len(phone) not in {10, 11}:
        raise ValidationError("Telefone do pagador inválido (DDD + número).")
    doc_type = "CPF" if len(doc) == 11 else "CNPJ"
    return {
        "name": user.full_name[:64],
        "email": user.email[:64],
        "type": "individual" if len(doc) == 11 else "company",
        "document": doc,
        "document_type": doc_type,
        "phones": {"mobile_phone": {"country_code": "55", "area_code": phone[:2], "number": phone[2:]}},
    }


def _client_ip() -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None
    return request.remote_addr
