from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin


class Document(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "documents"

    __table_args__ = (db.Index("ix_documents_company_user", "company_id", "user_id"),)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    file_name = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False, unique=True)
    mime_type = db.Column(db.String(120), nullable=True)
    size_bytes = db.Column(db.Integer, nullable=False)

    user = db.relationship("User", back_populates="documents")
