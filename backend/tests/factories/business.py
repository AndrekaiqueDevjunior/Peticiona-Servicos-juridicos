"""Factories de entidades de negócio: planos, serviços, pedidos, créditos, etc."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from itertools import count
from typing import Any

from app.core.extensions import db
from app.models import (
    CreditPurchase,
    CreditTransaction,
    Document,
    FinancialEntry,
    Petition,
    Plan,
    ServiceCatalogItem,
    ServiceOrder,
    ServiceOrderItem,
    User,
)

_seq = count(1)


def _next() -> int:
    return next(_seq)


# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------


def create_plan(
    *,
    code: str | None = None,
    name: str | None = None,
    monthly_price_cents: int = 48_000,
    monthly_credits_cents: int | None = None,
    petition_limit_monthly: int | None = None,
    is_active: bool = True,
    **extra: Any,
) -> Plan:
    seq = _next()
    plan_code = code or f"plano_teste_{seq}"
    # Atualiza se já existir para evitar UniqueConstraint violation
    plan = Plan.query.filter_by(code=plan_code).first()
    fields = {
        "name": name or f"Plano Teste {seq}",
        "monthly_price_cents": monthly_price_cents,
        "monthly_credits_cents": (
            monthly_credits_cents if monthly_credits_cents is not None else monthly_price_cents
        ),
        "petition_limit_monthly": petition_limit_monthly,
        "is_active": is_active,
        **extra,
    }
    if plan is None:
        plan = Plan(code=plan_code, **fields)
        db.session.add(plan)
    else:
        for key, value in fields.items():
            setattr(plan, key, value)
    db.session.flush()
    return plan


def create_service_catalog_item(
    *,
    code: str | None = None,
    title: str | None = None,
    section: str = "Petições",
    unit_price: int = 18_000,
    is_active: bool = True,
    **extra: Any,
) -> ServiceCatalogItem:
    seq = _next()
    svc_code = code or f"servico_teste_{seq}"
    item = ServiceCatalogItem.query.filter_by(code=svc_code).first()
    fields = {
        "title": title or f"Serviço Teste {seq}",
        "section": section,
        "unit_price": unit_price,
        "is_active": is_active,
        **extra,
    }
    if item is None:
        item = ServiceCatalogItem(code=svc_code, **fields)
        db.session.add(item)
    else:
        for key, value in fields.items():
            setattr(item, key, value)
    db.session.flush()
    return item


# ---------------------------------------------------------------------------
# Petição + Pedido
# ---------------------------------------------------------------------------


def create_petition(
    *,
    user: User,
    reference: str | None = None,
    area_direito: str = "Direito Civil",
    tipo_peticao: str = "Petição inicial comum",
    status: str = "pendente",
    **extra: Any,
) -> Petition:
    seq = _next()
    petition = Petition(
        user_id=user.id,
        company_id=user.company_id,
        reference=reference or f"PET-TEST-{seq:04d}",
        area_direito=area_direito,
        tipo_peticao=tipo_peticao,
        status=status,
        **extra,
    )
    db.session.add(petition)
    db.session.flush()
    return petition


def create_service_order(
    *,
    user: User,
    staff_user: User | None = None,
    petition: Petition | None = None,
    reference: str | None = None,
    total_amount: int = 18_000,
    status: str = "pendente",
    split_funcionario: int = 0,
    split_plataforma: int = 100,
    deadline_days: int = 3,
    item_title: str = "Petição",
    item_code: str = "servico_peticao",
    **extra: Any,
) -> ServiceOrder:
    seq = _next()
    if petition is None:
        petition = create_petition(user=user)
    order = ServiceOrder(
        user_id=user.id,
        company_id=user.company_id,
        petition_id=petition.id,
        staff_user_id=staff_user.id if staff_user else None,
        reference=reference or f"SO-TEST-{seq:04d}",
        total_amount=total_amount,
        status=status,
        split_funcionario=split_funcionario,
        split_plataforma=split_plataforma,
        deadline_at=datetime.now(timezone.utc) + timedelta(days=deadline_days),
        **extra,
    )
    db.session.add(order)
    db.session.flush()

    db.session.add(
        ServiceOrderItem(
            order_id=order.id,
            company_id=user.company_id,
            code=item_code,
            title=item_title,
            quantity=1,
            unit_price=total_amount,
            line_total=total_amount,
        )
    )
    db.session.flush()
    return order


# ---------------------------------------------------------------------------
# Documentos
# ---------------------------------------------------------------------------


def create_document(
    *,
    user: User,
    file_name: str = "documento-teste.pdf",
    stored_name: str | None = None,
    mime_type: str = "application/pdf",
    size_bytes: int = 1024,
    **extra: Any,
) -> Document:
    seq = _next()
    doc = Document(
        user_id=user.id,
        company_id=user.company_id,
        file_name=file_name,
        stored_name=stored_name or f"stored-{seq}-{file_name}",
        mime_type=mime_type,
        size_bytes=size_bytes,
        **extra,
    )
    db.session.add(doc)
    db.session.flush()
    return doc


# ---------------------------------------------------------------------------
# Financeiro / Créditos
# ---------------------------------------------------------------------------


def create_credit_transaction(
    *,
    user: User,
    amount: int = 10_000,
    type: str = "in",  # noqa: A002 (alinhar com nome da coluna)
    source: str = "test",
    description: str | None = None,
) -> CreditTransaction:
    seq = _next()
    tx = CreditTransaction(
        user_id=user.id,
        company_id=user.company_id,
        type=type,
        source=source,
        amount=amount,
        description=description or f"Transação de teste #{seq}",
    )
    db.session.add(tx)
    db.session.flush()
    return tx


def create_credit_purchase(
    *,
    user: User,
    package_name: str = "Plano Teste",
    package_id: str = "plano_teste",
    kind: str = "plan",
    source: str = "pagarme",
    amount_cents: int = 48_000,
    credit_cents: int | None = None,
    status: str = "paid",
    pagarme_charge_id: str | None = "ch_test_123",
    pagarme_order_id: str | None = "or_test_123",
    credited_at: datetime | None = None,
) -> CreditPurchase:
    seq = _next()
    purchase = CreditPurchase(
        user_id=user.id,
        company_id=user.company_id,
        code=f"CP-TEST-{seq:04d}",
        idempotency_key=f"idemp-test-{seq}",
        package_id=package_id,
        package_name=package_name,
        kind=kind,
        source=source,
        amount_cents=amount_cents,
        credit_cents=credit_cents if credit_cents is not None else amount_cents,
        status=status,
        pagarme_charge_id=pagarme_charge_id,
        pagarme_order_id=pagarme_order_id,
        credited_at=credited_at or (datetime.now(timezone.utc) if status == "paid" else None),
    )
    db.session.add(purchase)
    db.session.flush()
    return purchase


def create_financial_entry(
    *,
    actor: User,
    description: str = "Lançamento de teste",
    kind: str = "credit",
    amount_cents: int = 50_000,
    is_active: bool = True,
) -> FinancialEntry:
    entry = FinancialEntry(
        description=description,
        kind=kind,
        amount_cents=amount_cents,
        occurred_at=datetime.now(timezone.utc),
        company_id=actor.company_id,
        created_by_user_id=actor.id,
        is_active=is_active,
    )
    db.session.add(entry)
    db.session.flush()
    return entry
