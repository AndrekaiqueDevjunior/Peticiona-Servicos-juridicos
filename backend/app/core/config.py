from __future__ import annotations

import os
from pathlib import Path


def _load_dotenv() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    env_files = [repo_root / ".env", repo_root / "backend" / ".env"]

    for env_file in env_files:
        if not env_file.exists():
            continue

        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            if not key or key in os.environ:
                continue

            os.environ[key] = value.strip().strip('"').strip("'")


def _split_csv(value: str | None, default: list[str] | None = None) -> list[str]:
    if value is None:
        return list(default or [])

    parts = [item.strip() for item in value.split(",")]
    return [item for item in parts if item]


def _to_bool(value: str | bool | None, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


_load_dotenv()

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE_PATH = BACKEND_ROOT / "app" / "legalcraft.sqlite3"
DEFAULT_UPLOAD_FOLDER = BACKEND_ROOT / "app" / "uploads"


class Config:
    BACKEND_DIR = str(BACKEND_ROOT)

    SECRET_KEY = os.getenv("FLASK_SECRET_KEY") or os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY não configurada. Configure FLASK_SECRET_KEY ou SECRET_KEY.")
    # Em produção, exige chave forte
    is_production = os.getenv("FLASK_ENV") == "production" or not os.getenv("DEBUG", "true").lower() in {"true", "1", "yes"}
    if is_production and len(SECRET_KEY) < 32:
        raise ValueError("SECRET_KEY muito curta para produção. Use pelo menos 32 caracteres.")

    JWT_SECRET = os.getenv("JWT_SECRET") or SECRET_KEY
    
    JWT_EXPIRATION = int(os.getenv("JWT_EXPIRATION", "3600"))  # Reduzido para 1 hora em produção

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or f"sqlite:///{DEFAULT_SQLITE_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    CORS_ALLOWED_ORIGINS = _split_csv(
        os.getenv("CORS_ALLOWED_ORIGINS"),
        default=["http://localhost:3000", "http://localhost:8080"],
    )

    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(DEFAULT_UPLOAD_FOLDER))

    AUTH_RATE_LIMIT = int(os.getenv("AUTH_RATE_LIMIT", "12"))
    AUTH_RATE_WINDOW_SECONDS = int(os.getenv("AUTH_RATE_WINDOW_SECONDS", "60"))
    RATE_LIMIT_ENABLED = _to_bool(os.getenv("RATE_LIMIT_ENABLED"), True)

    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "")
    SMTP_USE_TLS = _to_bool(os.getenv("SMTP_USE_TLS"), True)

    SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
    SENDGRID_FROM = os.getenv("SENDGRID_FROM", "")

    # ── Resend ──────────────────────────────────────────────────────────────
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "no-reply@peticiona.app.br")
    # Endereço administrativo que recebe os formulários de contato do site
    RESEND_CONTACT_TO_EMAIL = os.getenv("RESEND_CONTACT_TO_EMAIL", os.getenv("NOTIFICATION_EMAIL", ""))
    # Segredo HMAC para validar webhooks do Resend (formato: whsec_...)
    RESEND_WEBHOOK_SECRET = os.getenv("RESEND_WEBHOOK_SECRET", "")

    NOTIFICATION_EMAIL = os.getenv("NOTIFICATION_EMAIL", "")
    FRONTEND_URL = os.getenv("FRONTEND_URL", os.getenv("FRONTEND_PUBLIC_URL", ""))
    FRONTEND_PUBLIC_URL = os.getenv("FRONTEND_PUBLIC_URL", os.getenv("FRONTEND_URL", ""))
    BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "")
    PASSWORD_RESET_TOKEN_TTL_SECONDS = int(
        os.getenv("PASSWORD_RESET_TOKEN_TTL_SECONDS", "3600")
    )

    PAGARME_API_BASE_URL = os.getenv("PAGARME_API_BASE_URL", "https://api.pagar.me/core/v5")
    PAGARME_TIMEOUT_SECONDS = int(os.getenv("PAGARME_TIMEOUT_SECONDS", "20"))
    PAGARME_DRY_RUN = _to_bool(os.getenv("PAGARME_DRY_RUN"), False)
    PAGARME_SECRET_KEY = os.getenv("PAGARME_SECRET_KEY", "")
    PAGARME_PUBLIC_KEY = os.getenv("PAGARME_PUBLIC_KEY", "")
    PAGARME_STATEMENT_DESCRIPTOR = os.getenv("PAGARME_STATEMENT_DESCRIPTOR", "PETICIONA")
    PAGARME_WEBHOOK_TOKEN = os.getenv("PAGARME_WEBHOOK_TOKEN", "")
