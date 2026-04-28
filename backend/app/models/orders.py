from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin


class ServiceCatalogItem(BaseModel, TimestampMixin, db.Model):
    __tablename__ = "service_catalog_items"

    code = db.Column(db.String(80), nullable=False, unique=True, index=True)
    section = db.Column(db.String(80), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    unit_price = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)


class ServiceOrder(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "service_orders"

    __table_args__ = (db.Index("ix_service_orders_company_status", "company_id", "status"),)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    reference = db.Column(db.String(40), nullable=False, unique=True, index=True)
    status = db.Column(db.String(30), nullable=False, default="pendente", index=True)
    total_amount = db.Column(db.Integer, nullable=False, default=0)

    user = db.relationship("User")
    items = db.relationship(
        "ServiceOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="joined",
    )


class ServiceOrderItem(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "service_order_items"

    order_id = db.Column(db.Integer, db.ForeignKey("service_orders.id"), nullable=False, index=True)
    code = db.Column(db.String(50), nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Integer, nullable=False)
    line_total = db.Column(db.Integer, nullable=False)

    order = db.relationship("ServiceOrder", back_populates="items")
