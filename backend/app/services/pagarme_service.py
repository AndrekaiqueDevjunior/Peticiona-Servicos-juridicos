from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from uuid import uuid4

import requests
from flask import current_app

from app.core.errors import AuthError, PaymentGatewayError, ValidationError

logger = logging.getLogger(__name__)


def _json_or_text(response: requests.Response) -> dict | str:
    try:
        return response.json()
    except ValueError:
        return response.text


def _gateway_message(body: dict | str) -> str:
    if isinstance(body, str):
        return body[:255] or "Falha ao processar pagamento."
    for key in ("message", "error", "detail"):
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:255]
    errors = body.get("errors")
    if isinstance(errors, list) and errors:
        first = errors[0]
        if isinstance(first, dict):
            for key in ("message", "description", "detail"):
                value = first.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()[:255]
        if isinstance(first, str):
            return first[:255]
    return "Falha ao processar pagamento."


class PagarmeClient:
    def __init__(self) -> None:
        self.base_url = current_app.config.get("PAGARME_API_BASE_URL", "https://api.pagar.me/core/v5").rstrip("/")
        self.timeout = int(current_app.config.get("PAGARME_TIMEOUT_SECONDS", 20))
        self.secret_key = current_app.config.get("PAGARME_SECRET_KEY", "")
        self.dry_run = bool(current_app.config.get("PAGARME_DRY_RUN", False))

    def _request(self, method: str, path: str, payload: dict | None = None, *, idempotency_key: str | None = None) -> dict:
        if not self.secret_key:
            raise PaymentGatewayError("Pagar.me não configurado no backend.")
        token = base64.b64encode(f"{self.secret_key}:".encode("utf-8")).decode("ascii")
        headers = {
            "Accept": "application/json",
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
            headers["X-Idempotency-Key"] = idempotency_key
        try:
            response = requests.request(
                method=method,
                url=f"{self.base_url}{path}",
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            logger.exception("pagarme_request_error path=%s", path)
            raise PaymentGatewayError("Não foi possível comunicar com o Pagar.me.") from exc
        body = _json_or_text(response)
        if response.status_code >= 400:
            logger.warning("pagarme_response_error status=%s path=%s body=%s", response.status_code, path, body)
            raise PaymentGatewayError(_gateway_message(body), details={"status_code": response.status_code, "body": body})
        if not isinstance(body, dict):
            raise PaymentGatewayError("Resposta inválida do Pagar.me.")
        return body

    def create_order(self, payload: dict, *, idempotency_key: str | None = None) -> dict:
        if self.dry_run:
            return self._dry_run_order(payload)
        return self._request("POST", "/orders", payload, idempotency_key=idempotency_key)

    def get_order(self, pagarme_order_id: str) -> dict:
        if self.dry_run:
            return {"id": pagarme_order_id, "status": "paid", "charges": [{"id": f"ch_{pagarme_order_id}", "status": "paid"}]}
        if not pagarme_order_id:
            raise ValidationError("ID do pedido Pagar.me obrigatório.")
        return self._request("GET", f"/orders/{pagarme_order_id}")

    def cancel_charge(self, charge_id: str, amount_cents: int | None = None) -> dict:
        payload = {"amount": amount_cents} if amount_cents else None
        return self._request("DELETE", f"/charges/{charge_id}", payload)

    def smoke_test(self) -> dict:
        if self.dry_run:
            return {"ok": True, "mode": "dry_run"}
        if not self.secret_key:
            raise PaymentGatewayError("Pagar.me não configurado no backend.")
        return {"ok": True, "mode": "live_configured"}

    def smoke_charge(self, *, method: str, customer: dict, card_token: str | None = None, billing_address: dict | None = None, amount: int = 100) -> dict:
        payment: dict = {"payment_method": method}
        if method == "credit_card":
            credit_card: dict = {"installments": 1, "statement_descriptor": current_app.config.get("PAGARME_STATEMENT_DESCRIPTOR", "PETICIONA")}
            if card_token:
                credit_card["card_token"] = card_token
            if billing_address:
                credit_card["card"] = {"billing_address": billing_address}
            payment["credit_card"] = credit_card
        payload = {
            "code": f"smoke-{uuid4().hex[:16]}",
            "customer": customer,
            "items": [{"amount": amount, "description": "Smoke test", "quantity": 1, "code": "smoke"}],
            "payments": [payment],
        }
        return self.create_order(payload, idempotency_key=payload["code"])

    def _dry_run_order(self, payload: dict) -> dict:
        method = ((payload.get("payments") or [{}])[0] or {}).get("payment_method", "credit_card")
        paid = method == "credit_card"
        order_id = f"or_dry_{uuid4().hex[:20]}"
        charge_id = f"ch_dry_{uuid4().hex[:20]}"
        transaction = {"id": f"tran_dry_{uuid4().hex[:20]}", "status": "captured" if paid else "waiting_payment"}
        if method == "pix":
            transaction.update({"qr_code": "00020101021226880014br.gov.bcb.pix", "qr_code_url": "", "expires_at": None})
        if method == "boleto":
            transaction.update({"url": "", "pdf": "", "barcode": ""})
        return {
            "id": order_id,
            "code": payload.get("code"),
            "status": "paid" if paid else "pending",
            "charges": [{"id": charge_id, "status": "paid" if paid else "pending", "last_transaction": transaction}],
        }


def require_webhook_token(provided: str | None) -> None:
    expected = current_app.config.get("PAGARME_WEBHOOK_TOKEN", "")
    if not expected:
        if current_app.config.get("TESTING"):
            return
        raise AuthError("Webhook Pagar.me não configurado.")
    if not provided or not hmac.compare_digest(str(provided), str(expected)):
        raise AuthError("Webhook Pagar.me não autorizado.")


def verify_webhook_signature(raw_body: bytes, signature_header: str | None) -> None:
    secret = current_app.config.get("PAGARME_WEBHOOK_TOKEN", "")
    if not signature_header:
        require_webhook_token(None)
        return
    if not secret:
        if current_app.config.get("TESTING"):
            return
        raise AuthError("Webhook Pagar.me não configurado.")
    received = signature_header.strip()
    candidates = []
    for digestmod, prefix in ((hashlib.sha256, "sha256="), (hashlib.sha1, "sha1=")):
        digest = hmac.new(str(secret).encode("utf-8"), raw_body, digestmod).hexdigest()
        candidates.extend([digest, f"{prefix}{digest}"])
    if not any(hmac.compare_digest(received, candidate) for candidate in candidates):
        logger.warning(
            "webhook_signature_mismatch received_prefix=%s body_len=%s",
            received[:12] if received else "(empty)",
            len(raw_body),
        )
        raise AuthError("Assinatura do webhook Pagar.me inválida.")
