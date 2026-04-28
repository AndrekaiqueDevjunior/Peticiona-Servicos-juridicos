from __future__ import annotations

import base64
import hashlib
import hmac
import json
from urllib import error, request

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
