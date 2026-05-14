from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin


class AuditLog(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "audit_logs"

    __table_args__ = (
        db.Index("ix_audit_logs_company_entity", "company_id", "entity_type"),
        db.Index("ix_audit_logs_user_action", "user_id", "action"),
        db.Index("ix_audit_logs_created_at", "created_at"),
    )

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    actor_role = db.Column(db.String(20), nullable=True)  # role no momento da ação
    action = db.Column(db.String(80), nullable=False, index=True)
    entity_type = db.Column(db.String(80), nullable=False, index=True)
    entity_id = db.Column(db.String(80), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)  # IPv4 ou IPv6
    user_agent = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=True, default="success")  # success, failure, error
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)

    user = db.relationship("User", back_populates="audit_logs")
