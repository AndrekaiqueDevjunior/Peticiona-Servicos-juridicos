from __future__ import annotations

import json
import os

from flask import current_app

from app.core.extensions import db

DEFAULT_CONTACT_EMAIL = "contato@peticiona.app.br"
DEFAULT_WHATSAPP_DISPLAY = "(11) 97494-0551"
DEFAULT_WHATSAPP_RAW = "5511974940551"


def _digits_only(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def _normalize_whatsapp_raw(display: str, raw: str | None) -> str:
    digits = _digits_only(raw or display)
    if not digits:
        return DEFAULT_WHATSAPP_RAW
    if len(digits) <= 11:
        return f"55{digits}"
    return digits


def _get_setting(key: str, default: str | None = None) -> str | None:
    """Busca configuração do banco de dados ou env vars."""
    try:
        from app.models.settings import PlatformSettings
        setting = PlatformSettings.query.filter_by(key=key).first()
        if setting:
            return setting.value
    except Exception:
        pass
    return os.getenv(f"SETTING_{key.upper()}", default)


def _set_setting(key: str, value: str) -> None:
    """Salva configuração no banco de dados."""
    from app.models.settings import PlatformSettings
    setting = PlatformSettings.query.filter_by(key=key).first()
    if setting:
        setting.value = value
    else:
        setting = PlatformSettings(key=key, value=value)
        db.session.add(setting)
    db.session.commit()


def get_contact_info() -> dict[str, str]:
    """Retorna informações de contato (banco de dados ou env vars)."""
    email = _get_setting("contact_email") or os.getenv("CONTACT_EMAIL", DEFAULT_CONTACT_EMAIL).strip() or DEFAULT_CONTACT_EMAIL
    whatsapp_display = (
        _get_setting("contact_whatsapp_display")
        or os.getenv("CONTACT_WHATSAPP_DISPLAY", DEFAULT_WHATSAPP_DISPLAY).strip()
        or DEFAULT_WHATSAPP_DISPLAY
    )
    whatsapp_raw = _normalize_whatsapp_raw(
        whatsapp_display,
        _get_setting("contact_whatsapp_raw") or os.getenv("CONTACT_WHATSAPP_RAW"),
    )
    return {
        "email": email,
        "whatsappDisplay": whatsapp_display,
        "whatsappRaw": whatsapp_raw,
        "whatsapp_display": whatsapp_display,
        "whatsapp_raw": whatsapp_raw,
    }


def update_contact_info(payload: dict | None, actor=None) -> dict[str, str]:
    """Atualiza informações de contato no banco de dados."""
    current = get_contact_info()
    data = payload or {}

    email = str(data.get("email", current["email"])).strip() or DEFAULT_CONTACT_EMAIL
    whatsapp_display = str(
        data.get("whatsappDisplay")
        or data.get("whatsapp_display")
        or current["whatsappDisplay"],
    ).strip() or DEFAULT_WHATSAPP_DISPLAY
    whatsapp_raw = _normalize_whatsapp_raw(
        whatsapp_display,
        str(data.get("whatsappRaw") or data.get("whatsapp_raw") or ""),
    )

    # Salvar no banco
    _set_setting("contact_email", email)
    _set_setting("contact_whatsapp_display", whatsapp_display)
    _set_setting("contact_whatsapp_raw", whatsapp_raw)

    return {
        "email": email,
        "whatsappDisplay": whatsapp_display,
        "whatsappRaw": whatsapp_raw,
        "whatsapp_display": whatsapp_display,
        "whatsapp_raw": whatsapp_raw,
    }
