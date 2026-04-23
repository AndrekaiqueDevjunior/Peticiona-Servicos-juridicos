from __future__ import annotations

import os
from pathlib import Path


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return ["http://localhost:3000"]
    return [item.strip() for item in value.split(",") if item.strip()]


class Config:
    BASE_DIR = Path(__file__).resolve().parents[3]
    BACKEND_DIR = BASE_DIR / "backend"

    SECRET_KEY = os.getenv("FLASK_SECRET_KEY") or os.getenv("SECRET_KEY") or "dev-secret-key"
    JWT_SECRET = os.getenv("JWT_SECRET") or SECRET_KEY
    JWT_EXPIRATION = int(os.getenv("JWT_EXPIRATION", "86400"))

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "SQLALCHEMY_DATABASE_URI",
        f"sqlite:///{(BACKEND_DIR / 'backend' / 'app' / 'legalcraft.sqlite3').resolve()}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = Path(
        os.getenv("UPLOAD_FOLDER", BACKEND_DIR / "backend" / "app" / "uploads")
    )
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
    CORS_ALLOWED_ORIGINS = _split_csv(os.getenv("CORS_ALLOWED_ORIGINS"))

    AUTH_RATE_LIMIT = int(os.getenv("AUTH_RATE_LIMIT", "12"))
    AUTH_RATE_WINDOW_SECONDS = int(os.getenv("AUTH_RATE_WINDOW_SECONDS", "60"))
