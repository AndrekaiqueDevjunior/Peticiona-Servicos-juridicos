from __future__ import annotations

import io
import zipfile
from pathlib import Path

from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from app.core.errors import ValidationError


ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "docx", "txt"}

EXTENSION_MIME_MAP = {
    "pdf": {"application/pdf"},
    "png": {"image/png"},
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    "txt": {"text/plain"},
}

DANGEROUS_EXTENSIONS = {
    "exe", "bat", "cmd", "com", "pif", "scr", "vbs", "js", "jar",
    "php", "asp", "aspx", "jsp", "sh", "ps1", "py", "rb", "pl",
    "msi", "deb", "rpm", "dmg", "app", "apk", "ipa", "html", "htm",
    "svg", "xml", "doc"  # .doc removido por risco de macros
}


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def ensure_allowed_document(filename: str, file_content: bytes | None = None) -> str:
    normalized = secure_filename(filename or "")

    if not normalized:
        raise ValidationError("Nome de arquivo inválido.")

    if "." not in normalized:
        raise ValidationError("Arquivo sem extensão válida.")

    extension = normalized.rsplit(".", 1)[1].lower()

    if extension in DANGEROUS_EXTENSIONS:
        raise ValidationError("Tipo de arquivo perigoso não permitido.")

    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise ValidationError("Tipo de arquivo não permitido.")

    if file_content is not None:
        if len(file_content) == 0:
            raise ValidationError("Arquivo vazio não permitido.")

        detected_mime = _detect_file_type(file_content, extension)

        if detected_mime is None:
            raise ValidationError("Não foi possível validar o conteúdo do arquivo.")

        expected_mimes = EXTENSION_MIME_MAP[extension]

        if detected_mime not in expected_mimes:
            raise ValidationError("Conteúdo do arquivo não corresponde à extensão.")

    return normalized


def _detect_file_type(content: bytes, extension: str) -> str | None:
    if not content or len(content) < 4:
        return None

    if extension == "pdf":
        if content.startswith(b"%PDF"):
            return "application/pdf"
        return None

    if extension == "png":
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        return None

    if extension in {"jpg", "jpeg"}:
        if content.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        return None

    if extension == "docx":
        if _is_valid_docx(content):
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return None

    if extension == "txt":
        if _is_safe_text_file(content):
            return "text/plain"
        return None

    return None


def _is_valid_docx(content: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as docx:
            names = set(docx.namelist())

            required_files = {
                "[Content_Types].xml",
                "_rels/.rels",
                "word/document.xml",
            }

            if not required_files.issubset(names):
                return False

            dangerous_entries = [
                name for name in names
                if name.lower().endswith((
                    ".exe", ".bat", ".cmd", ".sh", ".js", ".vbs", ".php", ".py"
                ))
            ]

            if dangerous_entries:
                return False

            return True

    except zipfile.BadZipFile:
        return False


def _is_safe_text_file(content: bytes) -> bool:
    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError:
        return False

    if "\x00" in decoded:
        return False

    return True


def ensure_upload_size(size_bytes: int) -> None:
    limit = current_app.config["MAX_UPLOAD_MB"] * 1024 * 1024

    if size_bytes <= 0:
        raise ValidationError("Arquivo vazio não permitido.")

    if size_bytes > limit:
        raise ValidationError("Arquivo excede o limite configurado.")


def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"

    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"

    return f"{size_bytes / (1024 * 1024):.1f} MB"


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
