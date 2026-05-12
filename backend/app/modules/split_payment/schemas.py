from __future__ import annotations

from app.core.errors import ValidationError


def load_split_preview_payload(payload: dict | None) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("Corpo JSON inválido.")
    return payload
