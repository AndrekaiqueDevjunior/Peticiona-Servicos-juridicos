from __future__ import annotations

import os


DEFAULT_CONTACT_EMAIL = "contato@peticiona.app.br"
DEFAULT_WHATSAPP_DISPLAY = "(11) 97494-0551"
DEFAULT_WHATSAPP_RAW = "5511974940551"
_CONTACT_OVERRIDE: dict[str, str] | None = None


def _digits_only(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def _normalize_whatsapp_raw(display: str, raw: str | None) -> str:
    digits = _digits_only(raw or display)
    if not digits:
        return DEFAULT_WHATSAPP_RAW
    if len(digits) <= 11:
        return f"55{digits}"
    return digits


def get_contact_info() -> dict[str, str]:
    """Return public contact settings used by /api/contact-info.

    The admin contact editor is still frontend-local today, so production keeps a
    deterministic backend default. Environment variables allow ops to override
    the public contact values without requiring a code deploy.
    """

    if _CONTACT_OVERRIDE is not None:
        return dict(_CONTACT_OVERRIDE)

    email = os.getenv("CONTACT_EMAIL", DEFAULT_CONTACT_EMAIL).strip() or DEFAULT_CONTACT_EMAIL
    whatsapp_display = (
        os.getenv("CONTACT_WHATSAPP_DISPLAY", DEFAULT_WHATSAPP_DISPLAY).strip()
        or DEFAULT_WHATSAPP_DISPLAY
    )
    whatsapp_raw = _normalize_whatsapp_raw(
        whatsapp_display,
        os.getenv("CONTACT_WHATSAPP_RAW"),
    )
    return {
        "email": email,
        "whatsappDisplay": whatsapp_display,
        "whatsappRaw": whatsapp_raw,
        "whatsapp_display": whatsapp_display,
        "whatsapp_raw": whatsapp_raw,
    }


def update_contact_info(payload: dict | None, actor=None) -> dict[str, str]:
    """Update contact settings for the current process.

    The production API already exposes PATCH /api/admin/settings/contact, but
    there is not a durable settings table in this deployment snapshot. Until the
    settings model is formalized, keep the update explicit and safe instead of
    letting the admin route crash at import time.
    """

    global _CONTACT_OVERRIDE

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
    _CONTACT_OVERRIDE = {
        "email": email,
        "whatsappDisplay": whatsapp_display,
        "whatsappRaw": whatsapp_raw,
        "whatsapp_display": whatsapp_display,
        "whatsapp_raw": whatsapp_raw,
    }
    return dict(_CONTACT_OVERRIDE)
