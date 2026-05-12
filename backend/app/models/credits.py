from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin


class CreditTransaction(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "credit_transactions"

    __table_args__ = (
        db.Index("ix_credit_transactions_company_user", "company_id", "user_id"),
        db.UniqueConstraint("user_id", "source", "description", name="uq_credit_transactions_release"),
    )

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    type = db.Column(db.String(10), nullable=False)
    source = db.Column(db.String(20), nullable=True)
    amount = db.Column(db.Integer, nullable=False)
    description = db.Column(db.String(255), nullable=False)

    user = db.relationship("User", back_populates="credit_transactions")
