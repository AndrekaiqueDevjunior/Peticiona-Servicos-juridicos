from __future__ import annotations

from uuid import uuid4

from app.core.errors import ValidationError


def get_split_payment_seed() -> dict:
    return {
        "quote_token": uuid4().hex,
        "modes": ["equal", "manual"],
        "currency": "BRL",
    }


def preview_split_payment(payload: dict) -> dict:
    quote_token = (payload.get("quote_token") or "").strip()
    mode = (payload.get("mode") or "equal").strip()
    parties = payload.get("parties") or []

    if not quote_token:
        raise ValidationError("quote_token é obrigatório.")
    if mode not in {"equal", "manual"}:
        raise ValidationError("Modo de rateio inválido.")

    if mode == "manual" and parties:
        total_percentage = sum(float(item.get("percentage", 0)) for item in parties)
        if round(total_percentage, 2) != 100.0:
            raise ValidationError("Rateio manual deve somar 100%.")

    if mode == "equal" and parties:
        equal_share = round(100 / len(parties), 2)
        normalized = [
            {
                "name": item.get("name") or f"Parte {index + 1}",
                "percentage": equal_share,
            }
            for index, item in enumerate(parties)
        ]
    else:
        normalized = [
            {
                "name": item.get("name") or f"Parte {index + 1}",
                "percentage": float(item.get("percentage", 0)),
            }
            for index, item in enumerate(parties)
        ]

    return {
        "is_valid": True,
        "quote_token": quote_token,
        "mode": mode,
        "parties": normalized,
    }
