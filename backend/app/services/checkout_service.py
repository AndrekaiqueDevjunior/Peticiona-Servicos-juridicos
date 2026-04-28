from __future__ import annotations

import hashlib
import re

from flask import current_app
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.extensions import db
from app.models import CreditTransaction, Order, PaymentEvent, ServiceCatalogItem
from app.models.base import utcnow
from app.services.audit_service import log_action
from app.services.credit_payment_service import (
    _antifraud_payload,
    _billing_address_payload,
    _clean_card_token,
    _customer_payload,
)
from app.services.pagarme_service import PagarmeClient
from app.services.serializers import format_brl_from_cents


ORDER_STATUSES = {"pending", "processing", "paid", "failed", "canceled", "refunded"}
PAID_STATUSES = {"paid", "captured", "success"}
FAILED_STATUSES = {"failed", "payment_failed", "refused", "not_authorized", "with_error"}
CANCELED_STATUSES = {"canceled", "cancelled"}
REFUNDED_STATUSES = {"refunded", "partial_refunded"}


def create_checkout_order(user, payload: dict) -> tuple[dict, int]:
    service = _service_from_payload(payload)
    idempotency_key = _optional_idempotency_key(payload.get("idempotency_key"))

    if idempotency_key:
        existing = Order.query.filter_by(user_id=user.id, idempotency_key=idempotency_key).first()
        if existing is not None:
            return {"order": serialize_checkout_order(existing)}, 200

    order = Order(
        user_id=user.id,
        company_id=user.company_id,
        service_id=service["code"],
        amount=service["unit_price"],
        currency="BRL",
        status="pending",
        idempotency_key=idempotency_key,
    )
    db.session.add(order)
    db.session.flush()

    log_action(
        action="checkout.order_created",
        entity_type="order",
        entity_id=order.id,
        user=user,
        metadata={
            "service_id": order.service_id,
            "amount": order.amount,
            "currency": order.currency,
        },
    )
    current_app.logger.info("checkout.order_created order_id=%s user_id=%s", order.id, user.id)
    db.session.commit()
    return {"order": serialize_checkout_order(order)}, 201


def create_checkout_payment(user, payload: dict, *, client_ip: str | None = None) -> tuple[dict, int]:
    order = _owned_order(user, payload.get("order_id"))
    _ensure_service_price_still_valid(order)

    if order.pagarme_order_id:
        return {"order": serialize_checkout_order(order)}, 200
    if order.status == "paid":
        raise ConflictError("Pedido já pago.")
    if order.status not in {"pending", "failed", "canceled"}:
        raise ConflictError("Pedido já possui pagamento em processamento.")

    payment_idempotency_key = _optional_idempotency_key(payload.get("idempotency_key"))
    if payment_idempotency_key:
        order.payment_idempotency_key = payment_idempotency_key

    card_token = _clean_card_token(payload.get("card_token"))
    customer = _customer_payload(user, payload.get("customer") or {})
    billing_address = _billing_address_payload(payload.get("billing_address") or {})
    antifraud = _antifraud_payload(payload.get("antifraud") or {})

    order.status = "processing"
    db.session.flush()

    pagarme_payload = _pagarme_order_payload(
        order=order,
        service=_service_by_id(order.service_id),
        customer=customer,
        billing_address=billing_address,
        card_token=card_token,
        client_ip=client_ip,
        antifraud=antifraud,
    )
    response = PagarmeClient().create_order(
        pagarme_payload,
        idempotency_key=payment_idempotency_key or f"checkout-payment-{order.id}",
    )
    _apply_pagarme_response(order, response)
    if order.status == "paid":
        _release_paid_order(order, user)

    log_action(
        action="checkout.payment_created",
        entity_type="order",
        entity_id=order.id,
        user=user,
        metadata={
            "status": order.status,
            "pagarme_order_id": order.pagarme_order_id,
            "pagarme_charge_id": order.pagarme_charge_id,
        },
    )
    current_app.logger.info(
        "checkout.payment_created order_id=%s status=%s pagarme_order_id=%s",
        order.id,
        order.status,
        order.pagarme_order_id,
    )
    db.session.commit()
    return {"order": serialize_checkout_order(order)}, 201


def get_checkout_status(user, order_id: object) -> dict:
    order = _owned_order(user, order_id)
    return {"order": serialize_checkout_order(order)}


def process_pagarme_webhook(payload: dict, *, raw_body: bytes) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("Payload de webhook inválido.")

    event_type = str(payload.get("type") or payload.get("event") or "").lower()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    gateway_event_id = _gateway_event_id(payload, raw_body)
    order = _find_order_from_webhook(data)

    current_app.logger.info(
        "checkout.webhook_received event_type=%s gateway_event_id=%s matched=%s",
        event_type,
        gateway_event_id,
        bool(order),
    )

    existing = PaymentEvent.query.filter_by(
        gateway="pagarme",
        gateway_event_id=gateway_event_id,
    ).first()
    if existing is not None:
        current_app.logger.info(
            "checkout.webhook_duplicate gateway_event_id=%s order_id=%s",
            gateway_event_id,
            existing.order_id,
        )
        return {"received": True, "duplicate": True, "matched": existing.order_id is not None}

    event = PaymentEvent(
        order_id=getattr(order, "id", None),
        gateway="pagarme",
        event_type=event_type or "unknown",
        gateway_event_id=gateway_event_id,
        payload_json=payload,
    )
    db.session.add(event)

    if order is None:
        _commit_webhook_event(event)
        return {"received": True, "duplicate": False, "matched": False}

    previous_status = order.status
    _copy_gateway_ids(order, data)
    next_status = _status_from_webhook(event_type, data)
    if next_status:
        _set_order_status(order, next_status)

    if order.status == "paid":
        _release_paid_order(order, order.user)

    action = "checkout.payment_approved" if order.status == "paid" else "checkout.payment_updated"
    if order.status in {"failed", "canceled", "refunded"}:
        action = "checkout.payment_failed"
    log_action(
        action=action,
        entity_type="order",
        entity_id=order.id,
        user=order.user,
        metadata={
            "event_type": event_type,
            "previous_status": previous_status,
            "status": order.status,
            "gateway_event_id": gateway_event_id,
        },
    )
    current_app.logger.info(
        "checkout.webhook_processed order_id=%s previous_status=%s status=%s",
        order.id,
        previous_status,
        order.status,
    )
    _commit_webhook_event(event)
    return {
        "received": True,
        "duplicate": False,
        "matched": True,
        "status": order.status,
    }


def serialize_checkout_order(order: Order) -> dict:
    service = _service_by_id(order.service_id, required=False)
    return {
        "id": order.id,
        "user_id": order.user_id,
        "service_id": order.service_id,
        "service_name": service.get("title") if service else None,
        "amount": order.amount,
        "amount_brl": format_brl_from_cents(order.amount),
        "currency": order.currency,
        "status": order.status,
        "paid": order.status == "paid",
        "released": order.released_at is not None,
        "pagarme_order_id": order.pagarme_order_id,
        "pagarme_charge_id": order.pagarme_charge_id,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "released_at": order.released_at.isoformat() if order.released_at else None,
    }


def _service_from_payload(payload: dict) -> dict:
    service_id = str(payload.get("service_id") or "").strip()
    return _service_by_id(service_id)


def _service_by_id(service_id: str, *, required: bool = True) -> dict:
    service = ServiceCatalogItem.query.filter_by(code=service_id, is_active=True).first()
    if service is not None:
        return {
            "code": service.code,
            "title": service.title,
            "description": service.description,
            "unit_price": service.unit_price,
        }
    if required:
        raise NotFoundError("Serviço não encontrado.")
    return {}


def _optional_idempotency_key(value: object) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    cleaned = str(value).strip()
    if not re.fullmatch(r"[A-Za-z0-9._:-]{12,80}", cleaned):
        raise ValidationError("Chave de idempotência inválida.")
    return cleaned


def _owned_order(user, order_id: object) -> Order:
    try:
        parsed_id = int(order_id)
    except (TypeError, ValueError):
        raise ValidationError("Pedido inválido.") from None

    order = db.session.get(Order, parsed_id)
    if order is None or order.user_id != user.id:
        raise NotFoundError("Pedido não encontrado.")
    return order


def _ensure_service_price_still_valid(order: Order) -> None:
    service = _service_by_id(order.service_id)
    if order.amount != service["unit_price"]:
        raise ConflictError("Valor do serviço foi atualizado. Crie um novo pedido.")


def _pagarme_order_payload(
    *,
    order: Order,
    service: dict,
    customer: dict,
    billing_address: dict,
    card_token: str,
    client_ip: str | None,
    antifraud: dict,
) -> dict:
    statement_descriptor = current_app.config["PAGARME_STATEMENT_DESCRIPTOR"][:13]
    payload = {
        "code": f"CHK-{order.id}",
        "closed": True,
        "items": [
            {
                "amount": order.amount,
                "description": service["title"],
                "quantity": 1,
                "code": order.service_id,
            }
        ],
        "customer": customer,
        "payments": [
            {
                "payment_method": "credit_card",
                "credit_card": {
                    "installments": 1,
                    "statement_descriptor": statement_descriptor,
                    "card_token": card_token,
                    "card": {"billing_address": billing_address},
                },
            }
        ],
        "metadata": {
            "checkout_order_id": str(order.id),
            "service_id": order.service_id,
            "user_id": str(order.user_id),
            "company_id": str(order.company_id or ""),
        },
        "session_id": antifraud["session_id"],
        "device": antifraud["device"],
    }
    if client_ip:
        payload["ip"] = client_ip
    if antifraud.get("location"):
        payload["location"] = antifraud["location"]
    return payload


def _apply_pagarme_response(order: Order, response: dict) -> None:
    if response.get("id"):
        order.pagarme_order_id = str(response["id"])
    _copy_gateway_ids(order, response)
    _set_order_status(order, _status_from_order(response))


def _copy_gateway_ids(order: Order, data: dict) -> None:
    charges = data.get("charges") if isinstance(data.get("charges"), list) else []
    charge = charges[0] if charges and isinstance(charges[0], dict) else {}
    if not charge and str(data.get("id") or "").startswith("ch_"):
        charge = data

    nested_order = data.get("order") if isinstance(data.get("order"), dict) else {}
    if data.get("id") and str(data.get("id")).startswith("or_"):
        order.pagarme_order_id = str(data["id"])
    if nested_order.get("id"):
        order.pagarme_order_id = str(nested_order["id"])
    if charge.get("id"):
        order.pagarme_charge_id = str(charge["id"])


def _status_from_order(response: dict) -> str:
    direct = _normalize_gateway_status(response.get("status"))
    if direct:
        return direct

    charges = response.get("charges") if isinstance(response.get("charges"), list) else []
    for charge in charges:
        if not isinstance(charge, dict):
            continue
        charge_status = _normalize_gateway_status(charge.get("status"))
        transaction = charge.get("last_transaction") if isinstance(charge.get("last_transaction"), dict) else {}
        transaction_status = _normalize_gateway_status(transaction.get("status"))
        if charge_status:
            return charge_status
        if transaction_status:
            return transaction_status
    return "pending"


def _status_from_webhook(event_type: str, data: dict) -> str:
    if event_type in {"order.paid", "charge.paid", "invoice.paid"}:
        return "paid"
    if event_type in {"order.payment_failed", "charge.payment_failed", "invoice.payment_failed"}:
        return "failed"
    if event_type in {"order.canceled", "charge.canceled", "invoice.canceled", "checkout.canceled"}:
        return "canceled"
    if event_type == "charge.refunded":
        return "refunded"
    if event_type == "charge.pending":
        return "pending"
    return _status_from_order(data)


def _normalize_gateway_status(value: object) -> str | None:
    status = str(value or "").lower()
    if status in PAID_STATUSES:
        return "paid"
    if status in FAILED_STATUSES:
        return "failed"
    if status in CANCELED_STATUSES:
        return "canceled"
    if status in REFUNDED_STATUSES:
        return "refunded"
    if status in {"processing", "authorized"}:
        return "processing"
    if status in {"pending", "waiting_payment"}:
        return "pending"
    return None


def _set_order_status(order: Order, status: str) -> None:
    if status not in ORDER_STATUSES:
        status = "pending"
    order.status = status
    if status == "paid" and order.paid_at is None:
        order.paid_at = utcnow()


def _find_order_from_webhook(data: dict) -> Order | None:
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    nested_order = data.get("order") if isinstance(data.get("order"), dict) else {}
    nested_metadata = nested_order.get("metadata") if isinstance(nested_order.get("metadata"), dict) else {}
    checkout_order_id = metadata.get("checkout_order_id") or nested_metadata.get("checkout_order_id")

    if checkout_order_id:
        try:
            order = db.session.get(Order, int(checkout_order_id))
        except (TypeError, ValueError):
            order = None
        if order is not None:
            return order

    order_id = nested_order.get("id") or (data.get("id") if str(data.get("id") or "").startswith("or_") else None)
    charge_id = data.get("id") if str(data.get("id") or "").startswith("ch_") else None
    filters = []
    if order_id:
        filters.append(Order.pagarme_order_id == str(order_id))
    if charge_id:
        filters.append(Order.pagarme_charge_id == str(charge_id))
    if not filters:
        return None
    return Order.query.filter(or_(*filters)).first()


def _gateway_event_id(payload: dict, raw_body: bytes) -> str:
    for key in ("id", "event_id", "hook_id"):
        value = payload.get(key)
        if value:
            return str(value)[:120]

    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    object_id = data.get("id") or data.get("code")
    event_type = payload.get("type") or payload.get("event")
    if object_id and event_type:
        return f"{event_type}:{object_id}"[:120]

    return hashlib.sha256(raw_body).hexdigest()


def _release_paid_order(order: Order, user) -> None:
    if order.released_at is not None:
        current_app.logger.info("checkout.release_duplicate order_id=%s", order.id)
        return

    service = _service_by_id(order.service_id, required=False)
    description = service.get("title") or order.service_id
    order.released_at = utcnow()
    db.session.add(
        CreditTransaction(
            user_id=order.user_id,
            company_id=order.company_id,
            type="in",
            source="avulso",
            amount=order.amount,
            description=f"Liberação Pagar.me - {description}",
        )
    )
    log_action(
        action="checkout.service_released",
        entity_type="order",
        entity_id=order.id,
        user=user,
        metadata={"service_id": order.service_id, "amount": order.amount},
    )
    current_app.logger.info("checkout.service_released order_id=%s", order.id)


def _commit_webhook_event(event: PaymentEvent) -> None:
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        current_app.logger.info("checkout.webhook_duplicate gateway_event_id=%s", event.gateway_event_id)
