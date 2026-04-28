from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin, utcnow


class FinancialEntry(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "financial_entries"

    description = db.Column(db.String(255), nullable=False)
    kind = db.Column(db.String(10), nullable=False, default="credit", index=True)
    amount_cents = db.Column(db.Integer, nullable=False)
    occurred_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    order_id = db.Column(db.Integer, db.ForeignKey("service_orders.id"), nullable=True, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)

    order = db.relationship("ServiceOrder")
    created_by = db.relationship("User", foreign_keys=[created_by_user_id])
