from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin, utcnow


class Plan(BaseModel, TimestampMixin, db.Model):
    __tablename__ = "plans"

    code = db.Column(db.String(40), nullable=False, unique=True, index=True)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    monthly_price_cents = db.Column(db.Integer, nullable=False, default=0)
    petition_limit_monthly = db.Column(db.Integer, nullable=True)
    monthly_credits_cents = db.Column(db.Integer, nullable=False, default=0)
    price_per_service_cents = db.Column(db.Integer, nullable=True)
    features_json = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    is_highlighted = db.Column(db.Boolean, nullable=False, default=False)
    cta_label = db.Column(db.String(80), nullable=True)


class Subscription(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "subscriptions"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    plan_id = db.Column(db.Integer, db.ForeignKey("plans.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="active", index=True)
    starts_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    ends_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User")
    plan = db.relationship("Plan")
