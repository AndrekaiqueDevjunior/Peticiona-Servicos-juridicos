from __future__ import annotations

import re

from app.core.extensions import db
from app.models.base import BaseModel, TimestampMixin


class Company(BaseModel, TimestampMixin, db.Model):
    __tablename__ = "companies"

    name = db.Column(db.String(120), nullable=False)
    slug = db.Column(db.String(120), nullable=False, unique=True, index=True)

    users = db.relationship("User", back_populates="company", lazy="dynamic")


class User(BaseModel, TimestampMixin, db.Model):
    __tablename__ = "users"

    full_name = db.Column(db.String(160), nullable=False)
    email = db.Column(db.String(160), nullable=False, unique=True, index=True)
    oab_number = db.Column(db.String(40), nullable=True)
    cpf = db.Column(db.String(20), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    role_title = db.Column(db.String(120), nullable=True)
    employee_code = db.Column(db.String(40), nullable=True)
    zip_code = db.Column(db.String(12), nullable=True)
    street = db.Column(db.String(180), nullable=True)
    street_number = db.Column(db.String(20), nullable=True)
    address_complement = db.Column(db.String(120), nullable=True)
    neighborhood = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(120), nullable=True)
    state = db.Column(db.String(2), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="client", index=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=True, index=True)
    active_plan_id = db.Column(db.Integer, db.ForeignKey("plans.id"), nullable=True)

    company = db.relationship("Company", back_populates="users")
    active_plan = db.relationship("Plan", foreign_keys=[active_plan_id])

    petitions = db.relationship("Petition", back_populates="user", lazy="dynamic")
    documents = db.relationship("Document", back_populates="user", lazy="dynamic")
    credit_transactions = db.relationship("CreditTransaction", back_populates="user", lazy="dynamic")
    audit_logs = db.relationship("AuditLog", back_populates="user", lazy="dynamic")


def unique_company_slug(base_name: str, *, existing: set[str]) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", base_name.lower()).strip("-")
    base_slug = normalized or "empresa"
    slug = base_slug
    counter = 2
    while slug in existing:
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug
