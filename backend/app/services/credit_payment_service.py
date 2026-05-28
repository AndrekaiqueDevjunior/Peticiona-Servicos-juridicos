from __future__ import annotations

import logging
import re
from datetime import timedelta
from uuid import uuid4

from flask import current_app
from sqlalchemy import or_

from app.core.errors import NotFoundError, RateLimitExceeded, ValidationError
from app.core.extensions import db
from app.models import CreditPurchase, CreditTransaction, User
from app.models.base import utcnow
from app.services.audit_service import log_action
from app.services.pagarme_service import PagarmeClient
from app.services.serializers import format_brl_from_cents

logger = logging.getLogger(__name__)


# Catálogo de pacotes adquiridos no checkout via Pagar.me.
# Express não é mais pacote avulso — virou upgrade pago no momento do pedido.
CREDIT_PACKAGES: dict[str, dict] = {
    "essencial": {
        "id": "essencial",
        "name": "Plano Essencial",
        "kind": "plan",
        "source": "plano",
        "amount_cents": 48000,
        "credit_cents": 48000,
        "credit_units": 3,
        "credit_kind": "common",
        "description": "R$ 480,00 — 3 créditos (R$ 160,00 por serviço).",
    },
    "profissional": {
        "id": "profissional",
        "name": "Plano Intermediário",
        "kind": "plan",
        "source": "plano",
        "amount_cents": 75000,
        "credit_cents": 75000,
        "credit_units": 5,
        "credit_kind": "common",
        "description": "R$ 750,00 — 5 créditos (R$ 150,00 por serviço).",
    },
    "estrategico": {
        "id": "estrategico",
        "name": "Plano Premium",
        "kind": "plan",
        "source": "plano",
        "amount_cents": 280000,
        "credit_cents": 280000,
        "credit_units": 20,
        "credit_kind": "common",
        "description": "R$ 2.800,00 — 20 créditos (R$ 140,00 por serviço).",
    },
}

PAID_STATUSES = {"paid", "captured"}
FAILED_STATUSES = {"failed", "canceled", "cancelled", "payment_failed", "refused"}


def get_credit_payment_config() -> dict:
    return {
        "public_key": current_app.config["PAGARME_PUBLIC_KEY"],
        "dry_run": bool(current_app.config.get("PAGARME_DRY_RUN")),
        "packages": [_serialize_package(item) for item in CREDIT_PACKAGES.values()],
    }


def create_credit_purchase(user, payload: dict, *, client_ip: str | None = None) -> dict:
    package = _package_from_payload(payload)
    idempotency_key = _clean_idempotency_key(payload.get("idempotency_key"))

    existing = CreditPurchase.query.filter_by(user_id=user.id, idempotency_key=idempotency_key).first()
    if existing is not None:
        return _serialize_purchase_response(existing)

    _ensure_purchase_velocity(user)

    card_token = _clean_card_token(payload.get("card_token"))
    customer = _customer_payload(user, payload.get("customer") or {})
    billing_address = _billing_address_payload(payload.get("billing_address") or {})
    antifraud = _antifraud_payload(payload.get("antifraud") or {})

    purchase = CreditPurchase(
        user_id=user.id,
        company_id=user.company_id,
        code=_next_purchase_code(user.id),
        idempotency_key=idempotency_key,
        package_id=package["id"],
        package_name=package["name"],
        kind=package["kind"],
        source=package["source"],
        amount_cents=package["amount_cents"],
        credit_cents=package["credit_cents"],
        status="processing",
        metadata_json={
            "session_id": antifraud.get("session_id"),
            "client_ip": client_ip,
        },
    )
    db.session.add(purchase)
    db.session.flush()

    order_payload = _pagarme_order_payload(
        purchase=purchase,
        package=package,
        customer=customer,
        billing_address=billing_address,
        card_token=card_token,
        client_ip=client_ip,
        antifraud=antifraud,
    )
    response = PagarmeClient().create_order(order_payload)
    _apply_pagarme_response(purchase, response)

    if purchase.status == "paid":
        _credit_purchase(purchase, user)

    log_action(
        action="credit_purchase.created",
        entity_type="credit_purchase",
        entity_id=purchase.id,
        user=user,
        metadata={
            "code": purchase.code,
            "package_id": purchase.package_id,
            "status": purchase.status,
            "pagarme_order_id": purchase.pagarme_order_id,
        },
    )
    db.session.commit()
    return _serialize_purchase_response(purchase)


def process_pagarme_webhook(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("Payload de webhook inválido.")

    event = str(payload.get("type") or payload.get("event") or "").lower()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    purchase = _find_purchase_from_webhook(data)
    if purchase is None:
        return {"received": True, "matched": False}

    previous_status = purchase.status
    webhook_status = _status_from_webhook(event, data)
    if webhook_status:
        purchase.status = webhook_status

    _copy_gateway_ids(purchase, data)
    if purchase.status == "paid":
        _credit_purchase(purchase, purchase.user)

    log_action(
        action="credit_purchase.webhook",
        entity_type="credit_purchase",
        entity_id=purchase.id,
        user=purchase.user,
        metadata={"event": event, "previous_status": previous_status, "status": purchase.status},
    )
    db.session.commit()
    return {"received": True, "matched": True, "status": purchase.status}


def _serialize_package(package: dict) -> dict:
    return {
        **package,
        "amount_brl": format_brl_from_cents(package["amount_cents"]),
        "credit_brl": format_brl_from_cents(package["credit_cents"]),
    }


def _package_from_payload(payload: dict) -> dict:
    package_id = (payload.get("package_id") or "").strip()
    package = CREDIT_PACKAGES.get(package_id)
    if package is None:
        raise NotFoundError("Pacote de créditos não encontrado.")
    return package


def _clean_idempotency_key(value: object) -> str:
    cleaned = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9._:-]{12,80}", cleaned):
        raise ValidationError("Chave de idempotência inválida.")
    return cleaned


def _clean_card_token(value: object) -> str:
    cleaned = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_\-]{8,120}", cleaned):
        raise ValidationError("Token do cartão inválido.")
    return cleaned


def _customer_payload(user, payload: dict) -> dict:
    document = _digits(payload.get("document"))
    if len(document) not in {11, 14}:
        raise ValidationError("CPF ou CNPJ do pagador é obrigatório.")

    phone = _phone_payload(payload.get("phone"))
    document_type = "CPF" if len(document) == 11 else "CNPJ"
    customer_type = "individual" if len(document) == 11 else "company"
    return {
        "name": user.full_name[:64],
        "email": user.email[:64],
        "type": customer_type,
        "document": document,
        "document_type": document_type,
        "phones": {"mobile_phone": phone},
    }


def _phone_payload(value: object) -> dict:
    digits = _digits(value)
    if len(digits) not in {10, 11}:
        raise ValidationError("Telefone do pagador inválido.")
    return {
        "country_code": "55",
        "area_code": digits[:2],
        "number": digits[2:],
    }


def _billing_address_payload(payload: dict) -> dict:
    street = _required_string(payload.get("street"), "Rua do endereço de cobrança é obrigatória.", max_len=80)
    number = _required_string(payload.get("number"), "Número do endereço de cobrança é obrigatório.", max_len=20)
    neighborhood = _required_string(payload.get("neighborhood"), "Bairro do endereço de cobrança é obrigatório.", max_len=80)
    city = _required_string(payload.get("city"), "Cidade do endereço de cobrança é obrigatória.", max_len=64)
    state = _required_string(payload.get("state"), "UF do endereço de cobrança é obrigatória.", max_len=2).upper()
    zip_code = _digits(payload.get("zip_code"))
    if len(zip_code) != 8:
        raise ValidationError("CEP do endereço de cobrança inválido.")
    if not re.fullmatch(r"[A-Z]{2}", state):
        raise ValidationError("UF do endereço de cobrança inválida.")

    complement = str(payload.get("complement") or "").strip()
    address = {
        "line_1": f"{number}, {street}, {neighborhood}",
        "zip_code": zip_code,
        "city": city,
        "state": state,
        "country": "BR",
    }
    if complement:
        address["line_2"] = complement[:80]
    return address


def _antifraud_payload(payload: dict) -> dict:
    session_id = str(payload.get("session_id") or uuid4().hex).strip()[:100]
    device = payload.get("device") if isinstance(payload.get("device"), dict) else {}
    clean_device = {
        "platform": str(device.get("platform") or "")[:80],
    }
    location = payload.get("location") if isinstance(payload.get("location"), dict) else None
    clean_location = None
    if location and location.get("latitude") and location.get("longitude"):
        clean_location = {
            "latitude": str(location["latitude"])[:40],
            "longitude": str(location["longitude"])[:40],
        }
    return {"session_id": session_id, "device": clean_device, "location": clean_location}


def _pagarme_order_payload(
    *,
    purchase: CreditPurchase,
    package: dict,
    customer: dict,
    billing_address: dict,
    card_token: str,
    client_ip: str | None,
    antifraud: dict,
) -> dict:
    credit_card = {
        "installments": 1,
        "statement_descriptor": current_app.config["PAGARME_STATEMENT_DESCRIPTOR"][:13],
        "card_token": card_token,
        "card": {"billing_address": billing_address},
    }

    order = {
        "code": purchase.code,
        "closed": True,
        "items": [
            {
                "amount": package["amount_cents"],
                "description": package["name"],
                "quantity": 1,
                "code": package["id"],
            }
        ],
        "customer": customer,
        "payments": [{"payment_method": "credit_card", "credit_card": credit_card}],
        "metadata": {
            "credit_purchase_id": str(purchase.id),
            "credit_purchase_code": purchase.code,
            "package_id": package["id"],
            "user_id": str(purchase.user_id),
            "company_id": str(purchase.company_id or ""),
        },
        "session_id": antifraud["session_id"],
        "device": antifraud["device"],
    }
    if client_ip:
        order["ip"] = client_ip
    if antifraud.get("location"):
        order["location"] = antifraud["location"]
    return order


def _apply_pagarme_response(purchase: CreditPurchase, response: dict) -> None:
    purchase.pagarme_order_id = str(response.get("id") or "") or None
    _copy_gateway_ids(purchase, response)
    purchase.status = _status_from_order(response)
    if purchase.status == "failed":
        purchase.failure_reason = _failure_reason(response)


def _copy_gateway_ids(purchase: CreditPurchase, data: dict) -> None:
    charges = data.get("charges") if isinstance(data.get("charges"), list) else []
    charge = charges[0] if charges and isinstance(charges[0], dict) else data if str(data.get("id") or "").startswith("ch_") else {}
    transaction = charge.get("last_transaction") if isinstance(charge.get("last_transaction"), dict) else {}
    if data.get("id") and str(data.get("id")).startswith("or_"):
        purchase.pagarme_order_id = data["id"]
    if charge.get("id"):
        purchase.pagarme_charge_id = charge["id"]
    if transaction.get("id"):
        purchase.pagarme_transaction_id = transaction["id"]
    antifraud = transaction.get("antifraud_response") if isinstance(transaction.get("antifraud_response"), dict) else {}
    if antifraud.get("status"):
        purchase.antifraud_status = str(antifraud["status"])[:60]


def _status_from_order(response: dict) -> str:
    status = str(response.get("status") or "").lower()
    if status in PAID_STATUSES:
        return "paid"
    if status in FAILED_STATUSES:
        return "failed"

    charges = response.get("charges") if isinstance(response.get("charges"), list) else []
    for charge in charges:
        if not isinstance(charge, dict):
            continue
        charge_status = str(charge.get("status") or "").lower()
        transaction = charge.get("last_transaction") if isinstance(charge.get("last_transaction"), dict) else {}
        transaction_status = str(transaction.get("status") or "").lower()
        if charge_status in PAID_STATUSES or transaction_status in PAID_STATUSES:
            return "paid"
        if charge_status in FAILED_STATUSES or transaction_status in FAILED_STATUSES:
            return "failed"
    return "pending"


def _status_from_webhook(event: str, data: dict) -> str | None:
    if event in {"order.paid", "charge.paid"}:
        return "paid"
    if event in {"order.payment_failed", "charge.payment_failed", "order.canceled", "charge.canceled"}:
        return "failed"
    return _status_from_order(data)


def _find_purchase_from_webhook(data: dict) -> CreditPurchase | None:
    order = data.get("order") if isinstance(data.get("order"), dict) else {}
    code = data.get("code") or order.get("code")
    order_id = order.get("id") or (data.get("id") if str(data.get("id") or "").startswith("or_") else None)
    charge_id = data.get("id") if str(data.get("id") or "").startswith("ch_") else None

    query = CreditPurchase.query
    filters = []
    if code:
        filters.append(CreditPurchase.code == str(code))
    if order_id:
        filters.append(CreditPurchase.pagarme_order_id == str(order_id))
    if charge_id:
        filters.append(CreditPurchase.pagarme_charge_id == str(charge_id))
    if not filters:
        return None
    return query.filter(or_(*filters)).first()


def _credit_purchase(purchase: CreditPurchase, user) -> None:
    """Credita o saldo do cliente após confirmação de pagamento Pagar.me.

    Idempotente por `idempotency_key=f"credit-purchase-{purchase.id}"`:
    o mesmo webhook chegando duas vezes (ou retry de processamento) não
    duplica o crédito. A flag `purchase.credited_at` é mantida como
    sentinela legacy — se já está preenchida, retornamos sem chamar o
    ledger (rotina antiga continua válida).
    """
    if purchase.credited_at is not None:
        return

    from app.services import credit_ledger

    purchase_owner = db.session.get(User, purchase.user_id) if purchase.user_id else None
    if purchase_owner is None:
        # Sem dono associado, não há quem creditar — registra warning
        # mas não derruba o fluxo de processamento do webhook.
        logger.warning(
            "credit_purchase_owner_missing purchase_id=%s user_id=%s",
            purchase.id,
            purchase.user_id,
        )
        return

    # Resolve units e kind do pacote — fonte de verdade é CREDIT_PACKAGES.
    # Para pacotes legados (não presentes mais no dict), faz fallback
    # conservador: 1 crédito comum (preserva o "valor" sem inflar saldo).
    package = CREDIT_PACKAGES.get(purchase.package_id) or {}
    credit_units = int(package.get("credit_units") or 1)
    credit_kind = str(package.get("credit_kind") or credit_ledger.KIND_COMMON)

    credit_ledger.credit(
        purchase_owner,
        amount=credit_units,
        source=purchase.source,
        description=f"Compra Pagar.me - {purchase.package_name}",
        idempotency_key=f"credit-purchase-{purchase.id}",
        company_id=purchase.company_id,
        kind=credit_kind,
    )
    purchase.credited_at = utcnow()

    log_action(
        action="credit_purchase.credited",
        entity_type="credit_purchase",
        entity_id=purchase.id,
        user=user,
        metadata={
            "code": purchase.code,
            "credit_units": credit_units,
            "credit_kind": credit_kind,
            "source": purchase.source,
        },
    )


def _serialize_purchase_response(purchase: CreditPurchase) -> dict:
    return {
        "purchase": {
            "id": purchase.id,
            "code": purchase.code,
            "package_id": purchase.package_id,
            "package_name": purchase.package_name,
            "kind": purchase.kind,
            "source": purchase.source,
            "amount_cents": purchase.amount_cents,
            "amount_brl": format_brl_from_cents(purchase.amount_cents),
            "credit_cents": purchase.credit_cents,
            "credit_brl": format_brl_from_cents(purchase.credit_cents),
            "status": purchase.status,
            "paid": purchase.status == "paid",
            "credited": purchase.credited_at is not None,
            "pagarme_order_id": purchase.pagarme_order_id,
            "antifraud_status": purchase.antifraud_status,
        }
    }


def _ensure_purchase_velocity(user) -> None:
    window_start = utcnow() - timedelta(minutes=15)
    attempts = CreditPurchase.query.filter(
        CreditPurchase.user_id == user.id,
        CreditPurchase.created_at >= window_start,
    ).count()
    if attempts >= 5:
        raise RateLimitExceeded("Muitas tentativas de pagamento. Aguarde alguns minutos.")


def _next_purchase_code(user_id: int) -> str:
    return f"CRED-{user_id}-{uuid4().hex[:18]}"


def _required_string(value: object, message: str, *, max_len: int) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise ValidationError(message)
    return cleaned[:max_len]


def _digits(value: object) -> str:
    return re.sub(r"\D", "", str(value or ""))


def _failure_reason(response: dict) -> str | None:
    charges = response.get("charges") if isinstance(response.get("charges"), list) else []
    for charge in charges:
        transaction = charge.get("last_transaction") if isinstance(charge, dict) else None
        if not isinstance(transaction, dict):
            continue
        gateway = transaction.get("gateway_response") if isinstance(transaction.get("gateway_response"), dict) else {}
        errors = gateway.get("errors") if isinstance(gateway.get("errors"), list) else []
        if errors:
            return str(errors[0])[:255]
        for key in ("acquirer_message", "status_reason"):
            if transaction.get(key):
                return str(transaction[key])[:255]
    return None
