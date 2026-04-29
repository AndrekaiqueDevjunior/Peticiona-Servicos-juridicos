from __future__ import annotations

import base64
import hashlib
import hmac
import json
from urllib import error, request
from uuid import uuid4

from flask import current_app

from app.core.errors import AuthError, PaymentGatewayError, ValidationError


class PagarmeClient:
    def __init__(self) -> None:
        self.base_url = current_app.config["PAGARME_API_BASE_URL"].rstrip("/")
        self.secret_key = current_app.config["PAGARME_SECRET_KEY"]
        self.timeout = current_app.config["PAGARME_TIMEOUT_SECONDS"]

    def create_order(self, payload: dict, *, idempotency_key: str | None = None) -> dict:
        if current_app.config.get("PAGARME_DRY_RUN"):
            return self._dry_run_order(payload)

        if not self.secret_key:
            raise ValidationError("PAGARME_SECRET_KEY não configurada.")

        return self._request("POST", "/orders", payload, idempotency_key=idempotency_key)

    def get_order(self, pagarme_order_id: str) -> dict:
        if current_app.config.get("PAGARME_DRY_RUN"):
            return {"id": pagarme_order_id, "status": "paid", "charges": []}

        if not self.secret_key:
            raise ValidationError("PAGARME_SECRET_KEY não configurada.")

        return self._request("GET", f"/orders/{pagarme_order_id}")

    def cancel_charge(self, charge_id: str, amount_cents: int | None = None) -> dict:
        """Estorno total (ou parcial) de uma cobrança via Pagar.me.

        Para estorno total, não informar amount_cents.
        Retorna o objeto charge atualizado com status 'canceled' ou 'partial_canceled'.
        """
        if current_app.config.get("PAGARME_DRY_RUN"):
            return {
                "id": charge_id,
                "status": "canceled",
                "amount": amount_cents or 0,
                "canceled_amount": amount_cents or 0,
            }

        if not self.secret_key:
            raise ValidationError("PAGARME_SECRET_KEY não configurada.")

        payload: dict = {}
        if amount_cents is not None:
            payload["amount"] = amount_cents

        return self._request("DELETE", f"/charges/{charge_id}", payload or None)

    def smoke_charge(
        self,
        *,
        method: str,
        customer: dict,
        card_token: str | None = None,
        billing_address: dict | None = None,
        amount: int = 100,
    ) -> dict:
        """Create a minimal R$ 1,00 charge to validate key configuration end-to-end.

        method: "credit_card" | "pix"
        In PAGARME_DRY_RUN mode returns a simulated response without hitting the API.
        """
        if current_app.config.get("PAGARME_DRY_RUN"):
            return self._dry_run_smoke(method, amount)

        if not self.secret_key:
            raise ValidationError("PAGARME_SECRET_KEY não configurada.")

        code = f"SMOKE-{uuid4().hex[:8].upper()}"
        items = [{"amount": amount, "description": "Teste de integração Peticiona", "quantity": 1, "code": "smoke"}]
        descriptor = current_app.config["PAGARME_STATEMENT_DESCRIPTOR"][:13]

        if method == "credit_card":
            payment: dict = {
                "payment_method": "credit_card",
                "credit_card": {
                    "card_token": card_token,
                    "installments": 1,
                    "statement_descriptor": descriptor,
                    "card": {"billing_address": billing_address or {}},
                },
            }
        else:
            payment = {"payment_method": "pix", "pix": {"expires_in": 300}}

        payload = {"code": code, "closed": True, "items": items, "customer": customer, "payments": [payment]}
        return self._request("POST", "/orders", payload)

    @staticmethod
    def _dry_run_smoke(method: str, amount: int) -> dict:
        code = f"SMOKE-DRY-{uuid4().hex[:8].upper()}"
        charge_id = f"dry_ch_{code}"
        tran_id = f"dry_tran_{code}"
        if method == "pix":
            return {
                "id": f"dry_or_{code}", "code": code, "status": "pending", "amount": amount,
                "charges": [{"id": charge_id, "status": "pending", "last_transaction": {
                    "id": tran_id, "status": "pending",
                    "qr_code": "00020126480014br.gov.bcb.pix0136dry-run-qr-code-peticiona52040000530398654031.005802BR5910Peticiona6009SaoPaulo62070503***6304ABCD",
                    "qr_code_url": "",
                    "expires_at": "2099-12-31T23:59:59Z",
                }}],
            }
        return {
            "id": f"dry_or_{code}", "code": code, "status": "paid", "amount": amount,
            "charges": [{"id": charge_id, "status": "paid", "amount": amount, "last_transaction": {
                "id": tran_id, "status": "captured", "success": True,
                "antifraud_response": {"status": "approved"},
            }}],
        }

    def smoke_test(self) -> dict:
        """Verify Pagar.me connectivity without creating charges.

        Calls GET /orders?page=1&size=1 to confirm the secret key is valid.
        Returns {"ok": true} on success or {"ok": false, "error": "..."} on failure.
        In dry-run mode returns {"ok": true, "dry_run": true} immediately.
        """
        if current_app.config.get("PAGARME_DRY_RUN"):
            return {"ok": True, "dry_run": True, "provider": "pagarme"}

        if not self.secret_key:
            return {"ok": False, "dry_run": False, "error": "PAGARME_SECRET_KEY não configurada."}

        try:
            self._request("GET", "/orders?page=1&size=1")
            return {"ok": True, "dry_run": False, "provider": "pagarme"}
        except PaymentGatewayError as exc:
            return {"ok": False, "dry_run": False, "error": str(exc)}
        except Exception:  # noqa: BLE001
            return {"ok": False, "dry_run": False, "error": "Erro inesperado ao conectar à Pagar.me."}

    def _request(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
        *,
        idempotency_key: str | None = None,
    ) -> dict:
        body = json.dumps(payload or {}).encode("utf-8")
        credentials = base64.b64encode(f"{self.secret_key}:".encode("utf-8")).decode("ascii")
        headers = {
            "Accept": "application/json",
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
            "User-Agent": "peticiona-backend/1.0",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        req = request.Request(
            f"{self.base_url}{path}",
            data=body if method != "GET" else None,
            method=method,
            headers=headers,
        )

        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            details = _json_or_text(raw)
            raise PaymentGatewayError(
                "A Pagar.me recusou a criação do pedido.",
                details={"status": exc.code, "response": details},
            ) from exc
        except error.URLError as exc:
            raise PaymentGatewayError("Não foi possível conectar à Pagar.me.") from exc

        parsed = _json_or_text(raw)
        if not isinstance(parsed, dict):
            raise PaymentGatewayError("Resposta inválida da Pagar.me.")
        return parsed

    @staticmethod
    def _dry_run_order(payload: dict) -> dict:
        code = payload.get("code") or "dry-run"
        amount = sum(int(item.get("amount") or 0) * int(item.get("quantity") or 1) for item in payload.get("items", []))
        return {
            "id": f"dry_or_{code}",
            "code": code,
            "status": "paid",
            "amount": amount,
            "charges": [
                {
                    "id": f"dry_ch_{code}",
                    "status": "paid",
                    "amount": amount,
                    "paid_amount": amount,
                    "last_transaction": {
                        "id": f"dry_tran_{code}",
                        "status": "captured",
                        "success": True,
                        "antifraud_response": {"status": "approved"},
                    },
                }
            ],
        }


def _json_or_text(raw: str) -> dict | list | str:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def require_webhook_token(provided: str | None) -> None:
    """Validate the static bearer token that guards webhook endpoints.

    No-op when PAGARME_WEBHOOK_TOKEN is not configured so that existing
    deployments are not broken by the change.  In production the token MUST
    be set — the preflight script checks for this.

    Uses hmac.compare_digest to prevent timing-based token enumeration.
    """
    expected = current_app.config.get("PAGARME_WEBHOOK_TOKEN", "")
    if not expected:
        return
    token = (provided or "").strip()
    if not token or not hmac.compare_digest(expected, token):
        raise AuthError("Webhook não autorizado.")


def verify_webhook_signature(raw_body: bytes, signature_header: str | None) -> None:
    secret_key = current_app.config.get("PAGARME_SECRET_KEY", "")
    if not secret_key:
        if current_app.config.get("PAGARME_DRY_RUN"):
            return
        raise AuthError("PAGARME_SECRET_KEY não configurada para validar webhook.")

    signature = (signature_header or "").strip()
    if not signature:
        raise AuthError("Assinatura do webhook ausente.")

    expected = hmac.new(secret_key.encode("utf-8"), raw_body, hashlib.sha1).hexdigest()
    accepted_values = {expected, f"sha1={expected}"}
    if not any(hmac.compare_digest(signature, candidate) for candidate in accepted_values):
        raise AuthError("Assinatura do webhook inválida.")
