from __future__ import annotations

from datetime import datetime, timezone

from app.core.extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BaseModel:
    id = db.Column(db.Integer, primary_key=True)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class CompanyScopedMixin:
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=True, index=True)
