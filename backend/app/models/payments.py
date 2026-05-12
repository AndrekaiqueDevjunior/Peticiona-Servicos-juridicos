from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin


class Order(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "orders"

    __table_args__ = (
        db.Index("ix_orders_user_status", "user_id", "status"),
        db.Index("ix_orders_pagarme_order_id", "pagarme_order_id"),
        db.Index("ix_orders_pagarme_charge_id", "pagarme_charge_id"),
        db.UniqueConstraint("user_id", "idempotency_key", name="uq_orders_user_idempotency"),
    )

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    service_id = db.Column(db.String(80), nullable=False, index=True)
    amount = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="BRL")
    status = db.Column(db.String(30), nullable=False, default="pending", index=True)
    pagarme_order_id = db.Column(db.String(80), nullable=True)
    pagarme_charge_id = db.Column(db.String(80), nullable=True)
    idempotency_key = db.Column(db.String(80), nullable=True)
    payment_idempotency_key = db.Column(db.String(80), nullable=True)
    paid_at = db.Column(db.DateTime(timezone=True), nullable=True)
    released_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User")
    events = db.relationship("PaymentEvent", back_populates="order", lazy="select")


class PaymentEvent(BaseModel, TimestampMixin, db.Model):
    __tablename__ = "payment_events"

    __table_args__ = (
        db.UniqueConstraint("gateway", "gateway_event_id", name="uq_payment_events_gateway_event"),
    )

    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=True, index=True)
    gateway = db.Column(db.String(40), nullable=False)
    event_type = db.Column(db.String(80), nullable=False)
    gateway_event_id = db.Column(db.String(120), nullable=False)
    payload_json = db.Column(db.JSON, nullable=False, default=dict)

    order = db.relationship("Order", back_populates="events")


class CreditPurchase(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "credit_purchases"

    __table_args__ = (
        db.Index("ix_credit_purchases_company_status", "company_id", "status"),
        db.Index("ix_credit_purchases_pagarme_order", "pagarme_order_id"),
        db.UniqueConstraint("code", name="uq_credit_purchases_code"),
        db.UniqueConstraint("user_id", "idempotency_key", name="uq_credit_purchases_user_idempotency"),
    )

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    code = db.Column(db.String(52), nullable=False)
    idempotency_key = db.Column(db.String(80), nullable=False)
    package_id = db.Column(db.String(40), nullable=False)
    package_name = db.Column(db.String(120), nullable=False)
    kind = db.Column(db.String(20), nullable=False)
    source = db.Column(db.String(20), nullable=False)
    amount_cents = db.Column(db.Integer, nullable=False)
    credit_cents = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(30), nullable=False, default="created", index=True)
    pagarme_order_id = db.Column(db.String(80), nullable=True)
    pagarme_charge_id = db.Column(db.String(80), nullable=True)
    pagarme_transaction_id = db.Column(db.String(80), nullable=True)
    antifraud_status = db.Column(db.String(60), nullable=True)
    failure_reason = db.Column(db.String(255), nullable=True)
    credited_at = db.Column(db.DateTime(timezone=True), nullable=True)
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)

    user = db.relationship("User")
