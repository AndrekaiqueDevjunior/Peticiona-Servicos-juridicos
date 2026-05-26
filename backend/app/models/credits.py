from __future__ import annotations

from app.core.extensions import db
from app.models.base import BaseModel, CompanyScopedMixin, TimestampMixin


class CreditTransaction(BaseModel, TimestampMixin, CompanyScopedMixin, db.Model):
    """Livro-razão de saldo do cliente.

    Toda escrita nesta tabela DEVE passar por
    ``app.services.credit_ledger`` — quem importa CreditTransaction
    direto para INSERT está furando a auditoria. Leituras avulsas (joins
    de relatório, etc.) seguem livres.

    Invariantes garantidos pelo módulo:
      * ``type`` ∈ {'in', 'out'} (CHECK ck_credit_transactions_type)
      * ``amount`` > 0 (CHECK ck_credit_transactions_amount_positive)
      * ``idempotency_key`` único quando não-nulo (índice parcial
        ``uq_credit_transactions_idempotency``); replay com a mesma chave
        devolve o registro original ao invés de duplicar.
    """

    __tablename__ = "credit_transactions"

    __table_args__ = (
        db.Index("ix_credit_transactions_company_user", "company_id", "user_id"),
        db.Index("ix_credit_transactions_user_kind", "user_id", "kind"),
        db.UniqueConstraint("user_id", "source", "description", name="uq_credit_transactions_release"),
        db.UniqueConstraint("idempotency_key", name="uq_credit_transactions_idempotency"),
        db.CheckConstraint("type IN ('in','out')", name="ck_credit_transactions_type"),
        db.CheckConstraint("amount > 0", name="ck_credit_transactions_amount_positive"),
        db.CheckConstraint(
            "kind IN ('common','peticao_express','recurso_express','legacy_cents')",
            name="ck_credit_transactions_kind",
        ),
    )

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    type = db.Column(db.String(10), nullable=False)
    source = db.Column(db.String(20), nullable=True)
    amount = db.Column(db.Integer, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    idempotency_key = db.Column(db.String(128), nullable=True)
    # Tipo do crédito. Valores em uso:
    #   'common'           — crédito comum (1 crédito = 1 serviço comum)
    #   'peticao_express'  — crédito vinculado a serviço de Petição Express
    #   'recurso_express'  — crédito vinculado a serviço de Recurso Express
    #   'legacy_cents'     — saldo legado em centavos (não conta no novo sistema)
    # O sistema NOVO opera em unidades (1 = 1 crédito). Rows com kind='legacy_cents'
    # mantém seu valor histórico em centavos, mas são IGNORADAS por compute_balance.
    kind = db.Column(db.String(40), nullable=False, default="common", index=True)

    user = db.relationship("User", back_populates="credit_transactions")
