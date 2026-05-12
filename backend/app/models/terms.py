from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin, utcnow


class TermsAcceptance(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "terms_acceptances"

    __table_args__ = (
        db.UniqueConstraint("user_id", "version", "text_hash", name="uq_terms_acceptance_user_version_hash"),
        db.Index("ix_terms_acceptances_company_user", "company_id", "user_id"),
    )

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    version = db.Column(db.String(40), nullable=False, index=True)
    text_hash = db.Column(db.String(128), nullable=False)
    accepted_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)

    user = db.relationship("User")
