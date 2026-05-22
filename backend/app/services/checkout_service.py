from __future__ import annotations

import logging
import re
from datetime import timezone
from uuid import uuid4

from flask import current_app
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.core.errors import ConflictError, NotFoundError, PaymentGatewayError, ValidationError
from app.core.extensions import db
from app.models import CreditTransaction, Order, PaymentEvent, Plan, ServiceCatalogItem, User
from app.services.audit_service import log_action
from app.services.pagarme_service import PagarmeClient

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = {"paid", "failed", "canceled", "refunded"}
PAYMENT_METHODS = {"credit_card", "pix", "boleto"}


def utcnow():
    from datetime import datetime

    return datetime.now(timezone.utc)


def format_brl_from_cents(value: int) -> str:
    return f"R$ {value / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _digits(value: object) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def _text(value: object, *, max_length: int = 255) -> str:
    return str(value or "").strip()[:max_length]


def _friendly_gateway_error(error: PaymentGatewayError) -> str:
    message = str(error).lower()
    if any(token in message for token in ("address", "endereço", "endereco", "billing", "cobrança", "cobranca", "zipcode", "zip_code", "cep")):
        return "Endereço de cobrança inválido. Confira CEP, rua, número, bairro, cidade e UF."
    if any(token in message for token in ("insufficient", "saldo", "limite")):
        return "Pagamento recusado por limite insuficiente. Use outro cartão ou método de pagamento."
    if any(token in message for token in ("invalid", "invál", "cvv", "expiration", "expir")):
        return "Dados do cartão inválidos. Confira número, validade, CVV e nome do titular."
    if any(token in message for token in ("antifraud", "fraud", "risco")):
        return "Pagamento não aprovado pela análise de segurança. Use outro cartão ou método."
    if any(token in message for token in ("refused", "recus", "declined", "denied")):
        return "Pagamento recusado pela operadora do cartão. Use outro cartão ou método."
    return "Não foi possível aprovar o pagamento. Confira os dados e tente novamente."


def _catalog_entry(service_id: str) -> tuple[str, int, str]:
    service = ServiceCatalogItem.query.filter_by(code=service_id, is_active=True).first()
    if service:
        return service.code, int(service.unit_price), service.title
    plan = Plan.query.filter_by(code=service_id, is_active=True).first()
    if plan:
        return plan.code, int(plan.monthly_price_cents), plan.name
    raise NotFoundError("Serviço ou plano não encontrado.")


def _service_name(service_id: str) -> str | None:
    service = ServiceCatalogItem.query.filter_by(code=service_id).first()
    if service:
        return service.title
    plan = Plan.query.filter_by(code=service_id).first()
    if plan:
        return plan.name
    return None


def serialize_checkout_order(order: Order) -> dict:
    # Usa _service_name (tolerante a is_active=False) com fallback para o
    # próprio service_id. Importante para pedidos históricos que apontam
    # para planos/serviços que foram desativados depois — antes a
    # serialização quebrava com NotFoundError e o endpoint inteiro
    # retornava 404, escondendo o histórico de pedidos do cliente.
    return {
        "id": str(order.id),
        "user_id": order.user_id,
        "service_id": order.service_id,
        "service_name": _service_name(order.service_id) or order.service_id,
        "amount": order.amount,
        "currency": order.currency,
        "status": order.status,
        "pagarme_order_id": order.pagarme_order_id,
        "pagarme_charge_id": order.pagarme_charge_id,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "released_at": order.released_at.isoformat() if order.released_at else None,
    }


def list_checkout_orders(user) -> dict:
    orders = (
        Order.query.filter_by(user_id=user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return {"orders": [serialize_checkout_order(order) for order in orders]}


def get_user_checkout_order(user, order_id: object) -> dict:
    order = _get_user_order(user, order_id)
    return {"order": serialize_checkout_order(order)}


def update_user_checkout_order(user, order_id: object, payload: dict) -> dict:
    order = _get_user_order(user, order_id)
    if order.status not in {"pending", "failed"}:
        raise ValidationError("Apenas pedidos pendentes ou falhados podem ser editados.")

    data = payload or {}
    changed = []
    if "service_id" in data:
        new_service_id = _text(data.get("service_id"), max_length=80)
        if not new_service_id:
            raise ValidationError("service_id obrigatório.")
        code, amount, _name = _catalog_entry(new_service_id)
        if code != order.service_id:
            order.service_id = code
            order.amount = amount
            changed.append("service_id")
    elif "amount" in data:
        # Permite ajustar quantidade somente quando service_id NÃO muda — derivado do catálogo.
        raise ValidationError("Para alterar valor, envie service_id (preço deriva do catálogo).")

    if not changed:
        raise ValidationError("Nenhum campo editável foi enviado.")

    log_action(
        action="checkout_order_updated_by_client",
        entity_type="order",
        entity_id=order.id,
        user=user,
        company_id=order.company_id,
        metadata={"changed": changed, "service_id": order.service_id, "amount": order.amount},
    )
    db.session.commit()
    return {"order": serialize_checkout_order(order)}


def cancel_user_checkout_order(user, order_id: object) -> dict:
    order = _get_user_order(user, order_id)
    if order.status == "paid":
        raise ValidationError("Pedidos pagos não podem ser cancelados (solicite reembolso).")
    if order.status in {"canceled", "refunded"}:
        return {"deleted": True, "order": serialize_checkout_order(order)}
    if order.status not in {"pending", "failed", "processing"}:
        raise ValidationError("Pedido em estado que não permite cancelamento.")
    order.status = "canceled"
    log_action(
        action="checkout_order_canceled_by_client",
        entity_type="order",
        entity_id=order.id,
        user=user,
        company_id=order.company_id,
        metadata={"previous_status": order.status},
    )
    db.session.commit()
    return {"deleted": True, "order": serialize_checkout_order(order)}


def _sanitize_payload(payload: dict) -> dict:
    """Remove sensitive data from payload before logging - PCI-DSS compliance."""
    if not isinstance(payload, dict):
        return payload
    
    sanitized = dict(payload)
    
    # Remove sensitive card data if present
    if "card" in sanitized and isinstance(sanitized["card"], dict):
        card = sanitized["card"]
        sensitive_fields = ["number", "cvv", "exp_month", "exp_year", "holder_name"]
        for field in sensitive_fields:
            if field in card:
                card[field] = "***REDACTED***"
    
    # Remove token from payment payload
    if "payments" in sanitized and isinstance(sanitized["payments"], list):
        for payment in sanitized["payments"]:
            if isinstance(payment, dict) and "credit_card" in payment:
                credit_card = payment["credit_card"]
                if isinstance(credit_card, dict):
                    if "card_token" in credit_card:
                        credit_card["card_token"] = "***REDACTED***"
                    if "card" in credit_card and isinstance(credit_card["card"], dict):
                        card_obj = credit_card["card"]
                        sensitive_fields = ["number", "cvv", "exp_month", "exp_year", "holder_name"]
                        for field in sensitive_fields:
                            if field in card_obj:
                                card_obj[field] = "***REDACTED***"
    
    # Remove sensitive customer data
    if "customer" in sanitized and isinstance(sanitized["customer"], dict):
        customer = sanitized["customer"]
        if "document" in customer:
            customer["document"] = "***REDACTED***"
        if "phones" in customer and isinstance(customer["phones"], dict):
            for phone_type in customer["phones"]:
                if isinstance(customer["phones"][phone_type], dict):
                    customer["phones"][phone_type]["number"] = "***REDACTED***"
    
    return sanitized


def _payment_event(order: Order | None, event_type: str, gateway_event_id: str, payload: dict) -> None:
    db.session.add(
        PaymentEvent(
            order_id=order.id if order else None,
            gateway="pagarme",
            event_type=event_type,
            gateway_event_id=gateway_event_id[:120],
            payload_json=_sanitize_payload(payload),
        )
    )


def _credit_amount_for_order(order: Order) -> int:
    plan = Plan.query.filter_by(code=order.service_id).first()
    if plan:
        configured = int(plan.monthly_credits_cents or 0)
        if configured > 0:
            return configured
        # Plano cadastrado sem monthly_credits_cents explícito: caímos no valor
        # pago para que o cliente receba o crédito equivalente ao que desembolsou.
    return max(0, int(order.amount or 0))


def _release_order(order: Order) -> None:
    """Quando um Order vira `paid`, libera o crédito ao saldo do cliente.

    Usa `credit_ledger.credit` com `idempotency_key=f"checkout-{order.id}"`
    — replay (ex.: webhook do Pagar.me chegando duas vezes) devolve a mesma
    transação sem duplicar. Ordem com `amount=0` (pedido gratuito) só marca
    `released_at` sem inserir nada no livro-razão.
    """
    from app.services import credit_ledger

    if order.status != "paid":
        return
    credit_amount = _credit_amount_for_order(order)
    if credit_amount > 0:
        owner = order.user or db.session.get(User, order.user_id)
        if owner is None:
            logger.warning("release_order_owner_missing order_id=%s", order.id)
            return
        credit_ledger.credit(
            owner,
            amount=credit_amount,
            source="checkout",
            description=f"Checkout #{order.id}",
            idempotency_key=f"checkout-{order.id}",
            company_id=order.company_id,
        )
    order.released_at = order.released_at or utcnow()


def _reverse_released_order(order: Order, *, reason: str) -> None:
    """Estorna o crédito quando o gateway reembolsa um Order já liberado.

    `allow_negative_balance=True`: se o cliente já gastou o crédito,
    o saldo fica negativo e isso é registrado como dívida — não há
    como o sistema recusar o estorno porque o dinheiro saiu da conta
    da empresa, não do saldo interno.

    Idempotência por `(order.id, reason)`: o mesmo motivo de estorno
    chamado duas vezes não duplica; razões diferentes (refund parcial
    seguido de cancelamento, por exemplo) geram registros distintos.
    """
    from app.services import credit_ledger

    credit_amount = _credit_amount_for_order(order)
    if not order.released_at or credit_amount <= 0:
        return
    owner = order.user or db.session.get(User, order.user_id)
    if owner is None:
        logger.warning("reverse_released_order_owner_missing order_id=%s", order.id)
        return
    description = f"Estorno Checkout #{order.id} ({reason})"
    credit_ledger.debit(
        owner,
        amount=credit_amount,
        source="checkout_refund",
        description=description,
        idempotency_key=f"checkout-refund-{order.id}-{reason}",
        company_id=order.company_id,
        allow_negative_balance=True,
    )
    order.released_at = None


def _set_paid(order: Order) -> None:
    order.status = "paid"
    order.paid_at = order.paid_at or utcnow()
    _release_order(order)


def _map_gateway_status(response: dict) -> str:
    status = _text(response.get("status"), max_length=40).lower()
    charges = response.get("charges") if isinstance(response.get("charges"), list) else []
    charge_status = ""
    if charges:
        charge_status = _text((charges[0] or {}).get("status"), max_length=40).lower()
    gateway_status = charge_status or status
    if gateway_status in {"paid", "captured"}:
        return "paid"
    if gateway_status in {"failed", "refused", "declined", "not_authorized", "with_error"}:
        return "failed"
    if gateway_status in {"canceled", "cancelled"}:
        return "canceled"
    if gateway_status in {"refunded", "partial_refunded"}:
        return "refunded"
    return "processing"


def _first_charge(response: dict) -> dict:
    charges = response.get("charges")
    if isinstance(charges, list) and charges and isinstance(charges[0], dict):
        return charges[0]
    return {}


def _next_action(method: str, response: dict) -> dict | None:
    transaction = _first_charge(response).get("last_transaction") or {}
    if method == "pix":
        return {
            "type": "pix",
            "qr_code": transaction.get("qr_code") or transaction.get("qr_code_text"),
            "qr_code_url": transaction.get("qr_code_url"),
            "expires_at": transaction.get("expires_at"),
        }
    if method == "boleto":
        return {
            "type": "boleto",
            "boleto_url": transaction.get("url") or transaction.get("pdf"),
            "expires_at": transaction.get("due_at") or transaction.get("expires_at"),
        }
    return {"type": "none"}


_DECLINE_MESSAGES: list[tuple[tuple[str, ...], str]] = [
    (("address", "endereço", "endereco", "billing", "cobrança", "cobranca", "zipcode", "zip_code", "cep"), "Endereço de cobrança inválido. Confira CEP, rua, número, bairro, cidade e UF."),
    (("insufficient", "no funds", "saldo insuf", "sem saldo", "limit"), "Cartão recusado por saldo ou limite insuficiente."),
    (("expired", "expirou", "vencido", "validade", "expir"), "Cartão vencido. Verifique a data de validade."),
    (("cvv", "security code", "código de segurança", "cvc", "csc"), "CVV inválido. Verifique o código de segurança."),
    (("antifraud", "fraud", "antifraude", "risco", "risk", "suspeita"), "Pagamento não aprovado pela análise de segurança. Tente outro cartão."),
    (("phone", "telefone"), "Telefone do comprador inválido ou ausente."),
    (("refused", "recus", "declined", "not authorized", "denied", "blocked", "bloqueado"), "Cartão recusado pela operadora. Tente outro cartão ou método."),
    (("invalid card", "cartão inválido", "número do cartão", "card number", "invalid number"), "Número do cartão inválido."),
    (("lost", "stolen", "roubado", "perdido"), "Cartão bloqueado pelo banco emissor."),
    (("timeout", "time out", "timed out"), "Tempo esgotado na operadora. Tente novamente."),
    (("invalid", "inválid", "malformed", "format"), "Dados do cartão inválidos. Verifique as informações."),
]

_GENERIC_DECLINE = "Pagamento não aprovado. Verifique os dados ou use outro cartão."


def _charge_failure_reason(response: dict) -> str:
    charge = _first_charge(response)
    if not charge:
        return _GENERIC_DECLINE
    if charge.get("status") not in ("failed", "refused", "declined", "not_authorized"):
        return _GENERIC_DECLINE
    transaction = charge.get("last_transaction") or {}
    gateway = transaction.get("gateway_response") or {}
    errors = gateway.get("errors")
    raw_message = ""
    if isinstance(errors, list):
        for err in errors:
            if isinstance(err, dict):
                msg = err.get("message") or err.get("description") or err.get("detail")
                if msg:
                    raw_message = _text(msg, max_length=255)
                    break
            elif isinstance(err, str) and err.strip():
                raw_message = err.strip()[:255]
                break
    if not raw_message:
        return _GENERIC_DECLINE
    lower = raw_message.lower()
    for tokens, friendly in _DECLINE_MESSAGES:
        if any(t in lower for t in tokens):
            return friendly
    return _GENERIC_DECLINE


def _phone(value: str) -> dict | None:
    digits = _digits(value)
    if len(digits) not in (10, 11):
        return None
    return {"country_code": "55", "area_code": digits[:2], "number": digits[2:]}


def _customer(user, buyer: dict | None) -> dict:
    data = buyer or {}
    name = _text(getattr(user, "full_name", "") or data.get("fullName") or data.get("name"), max_length=120)
    email = _text(getattr(user, "email", "") or data.get("email"), max_length=255).lower()
    document = _digits(getattr(user, "cpf", "") or data.get("cpf") or data.get("document"))
    phone = _phone(getattr(user, "phone", "") or data.get("phone"))
    if len(name) < 3:
        raise ValidationError("Nome do comprador obrigatório.")
    if "@" not in email:
        raise ValidationError("E-mail do comprador inválido.")
    if len(document) != 11:
        raise ValidationError("CPF do comprador inválido.")
    customer = {"name": name, "email": email, "type": "individual", "document": document, "code": str(user.id)}
    if phone:
        customer["phones"] = {"mobile_phone": phone}
    return customer


def _billing_address(payload: dict | None) -> dict:
    data = payload or {}
    street = _text(data.get("street"), max_length=120)
    number = _text(data.get("street_number") or data.get("number"), max_length=20)
    neighborhood = _text(data.get("neighborhood"), max_length=80)
    city = _text(data.get("city"), max_length=80)
    state = _text(data.get("state"), max_length=2).upper()
    zip_code = _digits(data.get("zip_code") or data.get("zipcode") or data.get("cep"))
    country = _text(data.get("country") or "BR", max_length=2).upper()
    if not street or not number or not neighborhood or not city or len(state) != 2 or len(zip_code) != 8:
        raise ValidationError("Endereço de cobrança inválido.")
    return {
        "line_1": f"{number}, {street}, {neighborhood}",
        "line_2": _text(data.get("complement"), max_length=120),
        "zip_code": zip_code,
        "city": city,
        "state": state,
        "country": country,
    }


def _card(card_payload: dict | None, billing_address: dict) -> dict:
    data = card_payload or {}
    
    # SECURITY: Reject raw card data - PCI-DSS compliance
    raw_card_fields = ["number", "cvv", "exp_month", "exp_year", "holder_name"]
    if any(data.get(field) for field in raw_card_fields):
        logger.warning("checkout_raw_card_data_rejected fields=%s", [f for f in raw_card_fields if data.get(f)])
        raise ValidationError("Dados de cartão brutos não são aceitos. Use a tokenização via Pagar.me SDK no frontend.")
    
    raw_installments = data.get("installments", 1)
    try:
        installments = int(raw_installments)
    except (TypeError, ValueError):
        raise ValidationError("Número de parcelas inválido.")
    if installments < 1 or installments > 12:
        raise ValidationError("Número de parcelas inválido.")
    
    # SECURITY: Require card_token for all credit card payments
    token = _text(data.get("token") or data.get("card_token"), max_length=255)
    if not token:
        raise ValidationError("Token do cartão obrigatório. O cartão deve ser tokenizado no frontend antes do envio.")
    
    credit_card = {
        "installments": installments,
        "statement_descriptor": current_app.config.get("PAGARME_STATEMENT_DESCRIPTOR", "PETICIONA"),
        "card_token": token,
        "card": {"billing_address": billing_address},
    }
    return credit_card


def _payment(method: str, payload: dict) -> dict:
    if method == "credit_card":
        card_data = payload.get("card") or {}
        # Pagar.me exige endereço de cobrança mesmo quando os dados do cartão
        # chegam tokenizados pelo frontend.
        billing = _billing_address(payload.get("billing_address"))
        return {"payment_method": "credit_card", "credit_card": _card(card_data, billing)}
    if method == "pix":
        return {"payment_method": "pix", "pix": {"expires_in": 3600}}
    if method == "boleto":
        return {"payment_method": "boleto", "boleto": {}}
    raise ValidationError("Forma de pagamento inválida.")


def _pagarme_payload(order: Order, user, payload: dict) -> dict:
    method = _text(payload.get("payment_method"), max_length=30)
    if method not in PAYMENT_METHODS:
        raise ValidationError("Forma de pagamento inválida.")
    service_name = _service_name(order.service_id) or order.service_id
    return {
        "code": f"checkout-{order.id}",
        "customer": _customer(user, payload.get("buyer")),
        "items": [{"amount": int(order.amount), "description": service_name, "quantity": 1, "code": order.service_id}],
        "payments": [_payment(method, payload)],
        "metadata": {"local_order_id": str(order.id), "user_id": str(order.user_id), "service_id": order.service_id},
    }


def create_checkout_order(user, payload: dict) -> tuple[dict, int]:
    service_id = _text((payload or {}).get("service_id"), max_length=80)
    if not service_id:
        raise ValidationError("Serviço obrigatório.")
    code, amount, _name = _catalog_entry(service_id)
    if amount < 0:
        raise ValidationError("Valor do serviço inválido.")
    # Validar preço esperado enviado pelo frontend (proteção contra preços desatualizados)
    expected_amount = (payload or {}).get("expected_amount")
    if expected_amount is not None:
        try:
            expected_int = int(expected_amount)
        except (ValueError, TypeError):
            expected_int = None
        if expected_int is not None and expected_int != amount:
            logger.warning(
                "checkout_price_mismatch user_id=%s service_id=%s expected=%s actual=%s",
                user.id,
                code,
                expected_int,
                amount,
            )
            raise ValidationError(
                f"Preço do serviço foi atualizado. Atualize a página e tente novamente. "
                f"Valor atual: {format_brl_from_cents(amount)}"
            )
    existing = (
        Order.query.filter(
            Order.user_id == user.id,
            Order.service_id == code,
            Order.status.in_(["pending", "processing"]),
        )
        .order_by(Order.id.desc())
        .first()
    )
    if existing:
        return {"order": serialize_checkout_order(existing)}, 200
    order = Order(
        user_id=user.id,
        service_id=code,
        amount=amount,
        currency="BRL",
        status="pending",
        idempotency_key=f"checkout-order-{user.id}-{code}-{uuid4().hex[:16]}",
        company_id=getattr(user, "company_id", None),
    )
    if amount == 0:
        order.status = "paid"
        order.paid_at = utcnow()
    db.session.add(order)
    db.session.flush()
    if amount == 0:
        _release_order(order)
    log_action(action="checkout_order_created", entity_type="order", entity_id=order.id, user=user, company_id=order.company_id, metadata={"service_id": code, "amount": amount})
    db.session.commit()
    return {"order": serialize_checkout_order(order)}, 201


def _get_user_order(user, order_id: object) -> Order:
    try:
        parsed_order_id = int(order_id)
    except (TypeError, ValueError) as exc:
        raise NotFoundError("Pedido não encontrado.") from exc
    order = Order.query.filter(Order.id == parsed_order_id, Order.user_id == user.id).first()
    if not order:
        raise NotFoundError("Pedido não encontrado.")
    return order


def _lock_user_order(user, order_id: object) -> Order:
    """Busca o pedido com SELECT FOR UPDATE para evitar race condition no pagamento."""
    try:
        parsed_order_id = int(order_id)
    except (TypeError, ValueError) as exc:
        raise NotFoundError("Pedido não encontrado.") from exc
    order = (
        Order.query
        .filter(Order.id == parsed_order_id, Order.user_id == user.id)
        .with_for_update()
        .first()
    )
    if not order:
        raise NotFoundError("Pedido não encontrado.")
    return order


def _sync_gateway_status(order: Order) -> None:
    if not order.pagarme_order_id or order.status in TERMINAL_STATUSES:
        return
    try:
        response = PagarmeClient().get_order(order.pagarme_order_id)
    except PaymentGatewayError:
        logger.warning("checkout_status_sync_failed order_id=%s pagarme_order_id=%s", order.id, order.pagarme_order_id)
        return
    status = _map_gateway_status(response)
    charge = _first_charge(response)
    if charge.get("id"):
        order.pagarme_charge_id = charge.get("id")
    if status == "paid":
        _set_paid(order)
    else:
        order.status = status
    _payment_event(order, "status_sync", f"sync:{order.id}:{uuid4().hex[:16]}", {"status": status, "gateway_order": response})
    db.session.commit()


def get_checkout_status(user, order_id: object) -> dict:
    order = _get_user_order(user, order_id)
    _sync_gateway_status(order)
    # Garante que pedidos já marcados como pagos mas que não tiveram crédito
    # liberado (ex.: plano sem `monthly_credits_cents` no momento da compra)
    # recebam o crédito ao recarregar o status.
    if order.status == "paid":
        _release_order(order)
        db.session.commit()
    return {"order": serialize_checkout_order(order)}


def create_checkout_payment(user, payload: dict, *, client_ip: str | None = None) -> tuple[dict, int]:
    body = payload or {}
    
    # SECURITY: Explicitly reject raw card data at entry point - PCI-DSS compliance
    if body.get("payment_method") == "credit_card":
        card_data = body.get("card") or {}
        raw_card_fields = ["number", "cvv", "exp_month", "exp_year", "holder_name"]
        if any(card_data.get(field) for field in raw_card_fields):
            logger.warning("checkout_raw_card_data_rejected_at_entry user_id=%s fields=%s", user.id, [f for f in raw_card_fields if card_data.get(f)])
            raise ValidationError("Dados de cartão brutos não são aceitos. Use a tokenização via Pagar.me SDK no frontend.")
    
    order = _lock_user_order(user, body.get("order_id"))
    method = _text(body.get("payment_method"), max_length=30)
    if order.status == "paid":
        return {"order": serialize_checkout_order(order), "next_action": {"type": "none"}}, 200
    if order.status == "processing" and order.pagarme_order_id:
        # Sincroniza com Pagar.me para ver se o PIX/boleto foi pago ou expirou
        _sync_gateway_status(order)
        if order.status == "paid":
            return {"order": serialize_checkout_order(order), "next_action": {"type": "none"}}, 200
        if order.status == "processing":
            # PIX/boleto ainda não confirmado — força failed para liberar nova tentativa
            order.status = "failed"
            db.session.commit()
    if order.status not in {"pending", "failed", "processing"}:
        raise ConflictError("Pedido não permite nova tentativa de pagamento.")
    if order.amount <= 0:
        _set_paid(order)
        db.session.commit()
        return {"order": serialize_checkout_order(order), "next_action": {"type": "none"}}, 200

    # Idempotency-Key ESTÁVEL: incrementamos o contador antes de chamar
    # o gateway; retry martelado da MESMA tentativa (mesma payment_attempts)
    # devolve a Pagar.me order original em vez de criar várias.
    # Cliente nervoso clicando 5x no botão "Tentar de novo" antes desse
    # commit ainda esbarra no _lock_user_order (FOR UPDATE) e serializa
    # — quem chegar 2º vê status='processing' e short-circuita acima.
    order.payment_attempts = (order.payment_attempts or 0) + 1
    idempotency_key = f"checkout-payment-{order.id}-{order.payment_attempts}"
    order.payment_idempotency_key = idempotency_key
    order.status = "processing"
    db.session.commit()
    try:
        pagarme_payload = _pagarme_payload(order, user, body)
        safe_payload = dict(pagarme_payload)
        safe_payload["payments"] = [{"payment_method": method}]
        _payment_event(order, "payment_attempt", f"attempt:{idempotency_key}", {"payload": safe_payload, "client_ip": client_ip})
        db.session.commit()
        response = PagarmeClient().create_order(pagarme_payload, idempotency_key=idempotency_key)
        order.pagarme_order_id = response.get("id")
        charge = _first_charge(response)
        order.pagarme_charge_id = charge.get("id") or order.pagarme_charge_id
        status = _map_gateway_status(response)
        if status == "paid":
            _set_paid(order)
        else:
            order.status = status
        _payment_event(order, "payment_response", response.get("id") or f"response:{idempotency_key}", {"status": status, "gateway_order": response})
        log_action(action="checkout_payment_created", entity_type="order", entity_id=order.id, user=user, company_id=order.company_id, metadata={"method": method, "gateway_status": status, "pagarme_order_id": order.pagarme_order_id})
        db.session.commit()
        result: dict = {"order": serialize_checkout_order(order), "next_action": _next_action(method, response)}
        if status == "failed":
            result["failure_reason"] = _charge_failure_reason(response)
        return result, 200
    except ValidationError as exc:
        order.status = "pending"
        db.session.commit()
        return {"error": str(exc), "order": serialize_checkout_order(order)}, 422
    except PaymentGatewayError as exc:
        logger.warning("checkout_payment_gateway_failed order_id=%s message=%s", order.id, exc)
        order.status = "failed"
        _payment_event(order, "payment_error", f"error:{idempotency_key}", {"message": str(exc)[:255]})
        db.session.commit()
        return {"error": _friendly_gateway_error(exc), "order": serialize_checkout_order(order)}, 402
    except Exception:
        db.session.rollback()
        order = _get_user_order(user, body.get("order_id"))
        order.status = "failed"
        _payment_event(order, "payment_error", f"error:{idempotency_key}", {"message": "internal_error"})
        db.session.commit()
        logger.exception("checkout_payment_unexpected_error order_id=%s", order.id)
        raise


def _extract_gateway_ids(payload: dict) -> tuple[str, str | None, str | None, str | None]:
    event_type = _text(payload.get("type") or payload.get("event") or payload.get("event_type"), max_length=80) or "unknown"
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    event_id = _text(payload.get("id") or data.get("id") or f"{event_type}:{uuid4().hex[:20]}", max_length=120)
    order_id = None
    charge_id = None
    metadata_order_id = None
    if event_type.startswith("order."):
        order_id = _text(data.get("id"), max_length=80)
    if event_type.startswith("charge."):
        charge_id = _text(data.get("id"), max_length=80)
        nested_order = data.get("order") if isinstance(data.get("order"), dict) else {}
        order_id = _text(nested_order.get("id"), max_length=80) or None
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    metadata_order_id = _text(metadata.get("local_order_id"), max_length=80) or None
    return event_type, event_id, order_id, charge_id, metadata_order_id


def _webhook_status(event_type: str, payload: dict) -> str | None:
    lower = event_type.lower()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    status = _text(data.get("status"), max_length=40).lower()
    if any(token in lower for token in ("paid", "approved", "captured")) or status in {"paid", "captured"}:
        return "paid"
    if any(token in lower for token in ("failed", "refused", "declined")) or status in {"failed", "refused", "declined", "not_authorized"}:
        return "failed"
    if "cancel" in lower or status in {"canceled", "cancelled"}:
        return "canceled"
    if "refund" in lower or status in {"refunded", "partial_refunded"}:
        return "refunded"
    if status in {"pending", "processing"}:
        return "processing"
    return None


def process_pagarme_webhook(payload: dict, *, raw_body: bytes) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("Payload do webhook inválido.")
    event_type, event_id, pagarme_order_id, charge_id, metadata_order_id = _extract_gateway_ids(payload)
    if PaymentEvent.query.filter_by(gateway="pagarme", gateway_event_id=event_id, event_type=event_type).first():
        return {"ok": True, "duplicate": True}
    order = None
    if metadata_order_id:
        order = Order.query.filter_by(id=int(metadata_order_id)).first() if metadata_order_id.isdigit() else None
    if not order and pagarme_order_id:
        order = Order.query.filter_by(pagarme_order_id=pagarme_order_id).first()
    if not order and charge_id:
        order = Order.query.filter_by(pagarme_charge_id=charge_id).first()
    status = _webhook_status(event_type, payload)
    if order and status:
        if pagarme_order_id:
            order.pagarme_order_id = pagarme_order_id
        if charge_id:
            order.pagarme_charge_id = charge_id
        if status == "paid":
            _set_paid(order)
        else:
            if status in {"refunded", "canceled"}:
                _reverse_released_order(order, reason=status)
            order.status = status
        log_action(action="checkout_webhook_status", entity_type="order", entity_id=order.id, user=None, company_id=order.company_id, metadata={"event_type": event_type, "status": status})
    _payment_event(order, event_type, event_id, payload)
    db.session.commit()
    return {"ok": True, "processed": bool(order and status), "status": status, "order_id": order.id if order else None}
