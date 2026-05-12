from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin


class Petition(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "petitions"

    __table_args__ = (db.Index("ix_petitions_company_status", "company_id", "status"),)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    reference = db.Column(db.String(40), nullable=False, unique=True, index=True)
    area_direito = db.Column(db.String(120), nullable=False)
    tipo_peticao = db.Column(db.String(160), nullable=True)
    numero_processo = db.Column(db.String(60), nullable=True)
    data_publicacao = db.Column(db.String(40), nullable=True)
    justica_gratuita = db.Column(db.Boolean, nullable=False, default=False)
    tutela_urgencia = db.Column(db.Boolean, nullable=False, default=False)
    advogado_subscritor = db.Column(db.String(160), nullable=True)
    resumo_caso = db.Column(db.Text, nullable=True)
    detalhes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), nullable=False, default="pendente", index=True)

    user = db.relationship("User", back_populates="petitions")
    parties = db.relationship(
        "PetitionParty",
        back_populates="petition",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    document_links = db.relationship(
        "PetitionDocumentLink",
        back_populates="petition",
        cascade="all, delete-orphan",
        lazy="joined",
    )


class PetitionParty(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "petition_parties"

    petition_id = db.Column(db.Integer, db.ForeignKey("petitions.id"), nullable=False, index=True)
    nome = db.Column(db.String(160), nullable=False)
    tipo = db.Column(db.String(60), nullable=False)

    petition = db.relationship("Petition", back_populates="parties")


class PetitionDocumentLink(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    __tablename__ = "petition_document_links"

    petition_id = db.Column(db.Integer, db.ForeignKey("petitions.id"), nullable=False, index=True)
    document_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=False, index=True)

    petition = db.relationship("Petition", back_populates="document_links")
    document = db.relationship("Document")
