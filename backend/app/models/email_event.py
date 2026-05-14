from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, TimestampMixin


class EmailEvent(BaseModel, TimestampMixin, db.Model):
    """Registra eventos de e-mail recebidos via webhook do Resend."""

    __tablename__ = "email_events"

    provider = db.Column(db.String(40), nullable=False, default="resend")
    event_id = db.Column(db.String(255), nullable=True, unique=True, index=True)
    event_type = db.Column(db.String(80), nullable=False)
    recipient = db.Column(db.String(255), nullable=True)
    subject = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(40), nullable=True)
    payload_json = db.Column(db.Text, nullable=True)

    def __repr__(self) -> str:
        return f"<EmailEvent id={self.id} type={self.event_type} recipient={self.recipient}>"
