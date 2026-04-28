from __future__ import annotations

import os
from pathlib import Path


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return ["http://localhost:3000"]
    return [item.strip() for item in value.split(",") if item.strip()]


class Config:
    BACKEND_DIR = Path(__file__).resolve().parents[2]

    SECRET_KEY = os.getenv("FLASK_SECRET_KEY") or os.getenv("SECRET_KEY") or "dev-secret-key"
    JWT_SECRET = os.getenv("JWT_SECRET") or SECRET_KEY
    JWT_EXPIRATION = int(os.getenv("JWT_EXPIRATION", "86400"))

    SQLALCHEMY_DATABASE_URI = (
        os.getenv("SQLALCHEMY_DATABASE_URI")
        or os.getenv("DATABASE_URL")
        or f"sqlite:///{(BACKEND_DIR / 'app' / 'legalcraft.sqlite3').resolve()}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = Path(
        os.getenv("UPLOAD_FOLDER", BACKEND_DIR / "app" / "uploads")
    )
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
    CORS_ALLOWED_ORIGINS = _split_csv(os.getenv("CORS_ALLOWED_ORIGINS"))

    AUTH_RATE_LIMIT = int(os.getenv("AUTH_RATE_LIMIT", "12"))
    AUTH_RATE_WINDOW_SECONDS = int(os.getenv("AUTH_RATE_WINDOW_SECONDS", "60"))

    PAGARME_API_BASE_URL = os.getenv("PAGARME_API_BASE_URL", "https://api.pagar.me/core/v5")
    PAGARME_SECRET_KEY = os.getenv("PAGARME_SECRET_KEY", "")
    PAGARME_PUBLIC_KEY = os.getenv("PAGARME_PUBLIC_KEY", "")
    PAGARME_STATEMENT_DESCRIPTOR = os.getenv("PAGARME_STATEMENT_DESCRIPTOR", "PETICIONA")
    PAGARME_WEBHOOK_TOKEN = os.getenv("PAGARME_WEBHOOK_TOKEN", "")
    PAGARME_TIMEOUT_SECONDS = int(os.getenv("PAGARME_TIMEOUT_SECONDS", "20"))
    PAGARME_DRY_RUN = os.getenv("PAGARME_DRY_RUN", "").lower() in {"1", "true", "yes", "on"}

    # E-mail (SMTP) — usado pelo endpoint POST /api/notify-email.
    # Compatível com qualquer provedor SMTP: Gmail, Brevo, Mailgun, AWS SES, etc.
    # Deixe SMTP_HOST vazio para desabilitar o envio (dry-run: loga no console).
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "")           # ex: "Peticiona <noreply@peticiona.app.br>"
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() not in {"0", "false", "no", "off"}
    # Endereço que recebe as notificações de pedidos/comentários.
    NOTIFICATION_EMAIL = os.getenv("NOTIFICATION_EMAIL", "")
