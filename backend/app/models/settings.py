from __future__ import annotations

from app.core.extensions import db
from app.models.base import TimestampMixin


class PlatformSettings(db.Model, TimestampMixin):
    """Configurações globais da plataforma (contato, etc.)."""

    __tablename__ = "platform_settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(80), unique=True, nullable=False, index=True)
    value = db.Column(db.Text, nullable=False)

    def __repr__(self) -> str:
        return f"<PlatformSettings {self.key}={self.value[:20]}>"
