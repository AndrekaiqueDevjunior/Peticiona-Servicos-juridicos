from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin


class AuditLog(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "audit_logs"

    __table_args__ = (db.Index("ix_audit_logs_company_entity", "company_id", "entity_type"),)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    action = db.Column(db.String(80), nullable=False)
    entity_type = db.Column(db.String(80), nullable=False)
    entity_id = db.Column(db.String(80), nullable=False)
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)

    user = db.relationship("User", back_populates="audit_logs")
