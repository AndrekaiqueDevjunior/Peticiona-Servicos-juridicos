from __future__ import annotations

from pathlib import Path

from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from app.core.errors import ValidationError

ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx", "txt"}


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def ensure_allowed_document(filename: str) -> str:
    normalized = secure_filename(filename)
    if "." not in normalized:
        raise ValidationError("Arquivo sem extensão válida.")

    extension = normalized.rsplit(".", 1)[1].lower()
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise ValidationError("Tipo de arquivo não permitido.")
    return normalized


def ensure_upload_size(size_bytes: int) -> None:
    limit = current_app.config["MAX_UPLOAD_MB"] * 1024 * 1024
    if size_bytes > limit:
        raise ValidationError("Arquivo excede o limite configurado.")


def upload_folder() -> Path:
    folder = Path(current_app.config["UPLOAD_FOLDER"])
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"
