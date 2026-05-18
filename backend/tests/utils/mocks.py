"""Mocks de integrações externas (Pagar.me, SMTP).

A premissa é simples: nenhum teste pode atingir a rede. Esses mocks
substituem os clientes reais via `monkeypatch` ou via injeção em fixture.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4


class FakePagarmeClient:
    """Substituto para `PagarmeClient` que registra chamadas e devolve respostas
    determinísticas. Use via `monkeypatch.setattr` no service que instancia o
    cliente.
    """

    def __init__(self, *, status: str = "paid", cancel_status: str = "canceled") -> None:
        self.status = status
        self.cancel_status = cancel_status
        self.calls: list[dict[str, Any]] = []

    def _record(self, action: str, payload: Any = None) -> None:
        self.calls.append({"action": action, "payload": payload})

    # ------------------------------------------------------------------ orders

    def create_order(self, payload: dict, *, idempotency_key: str | None = None) -> dict:
        self._record("create_order", {"payload": payload, "idempotency_key": idempotency_key})
        order_id = f"or_test_{uuid4().hex[:12]}"
        charge_id = f"ch_test_{uuid4().hex[:12]}"
        return {
            "id": order_id,
            "status": self.status,
            "charges": [
                {
                    "id": charge_id,
                    "status": self.status,
                    "last_transaction": {
                        "qr_code": "pix-mock",
                        "qr_code_url": "https://example.com/pix.png",
                    },
                }
            ],
        }

    def get_order(self, pagarme_order_id: str) -> dict:
        self._record("get_order", pagarme_order_id)
        return {
            "id": pagarme_order_id,
            "status": self.status,
            "charges": [{"id": f"ch_{pagarme_order_id}", "status": self.status}],
        }

    def cancel_charge(self, charge_id: str, amount_cents: int | None = None) -> dict:
        self._record("cancel_charge", {"charge_id": charge_id, "amount": amount_cents})
        return {"id": charge_id, "status": self.cancel_status}

    def smoke_test(self) -> dict:
        self._record("smoke_test")
        return {"ok": True, "mode": "test_mock"}

    def smoke_charge(self, **payload: Any) -> dict:
        self._record("smoke_charge", payload)
        return self.create_order({"items": [], "customer": payload.get("customer", {})})


def capture_emails(monkeypatch, *, target_module: Any) -> list[dict[str, Any]]:
    """Substitui `target_module.send_email` por um spy que captura os parâmetros.

    Exemplo:
        from app.services import password_reset_service
        emails = capture_emails(monkeypatch, target_module=password_reset_service)
        # ...trigger
        assert emails and emails[0]['to'] == 'foo@bar.com'

    O spy é tolerante a kwargs novos (html, headers, etc.) para sobreviver
    a refactors no signature do `send_email`.
    """
    captured: list[dict[str, Any]] = []

    def _spy(**kwargs: Any) -> bool:
        captured.append(dict(kwargs))
        return True

    monkeypatch.setattr(target_module, "send_email", _spy)
    return captured
