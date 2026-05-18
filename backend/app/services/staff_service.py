from __future__ import annotations

from datetime import datetime, timezone

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.extensions import db
from app.domain.permissions import scoped_query
from app.models import ServiceOrder, User
from app.services.audit_service import log_action
from app.services.serializers import format_brl_from_cents, serialize_order


def _serialize_order_for_staff(order: ServiceOrder) -> dict:
    """Versão da serialização do pedido sem expor o valor cheio do serviço
    ao funcionário — apenas o repasse devido a ele."""
    data = serialize_order(order)
    # Funcionário não enxerga o valor bruto cobrado do cliente, somente o
    # repasse líquido conforme o split definido pelo admin.
    data.pop("total_amount", None)
    data.pop("total_brl", None)
    data.pop("split_plataforma", None)

    # Calcula e injeta o repasse devido ao funcionário (split_funcionario %).
    split_pct = order.split_funcionario or 0
    repasse_cents = int((order.total_amount or 0) * split_pct / 100)
    data["staff_payout_cents"] = repasse_cents
    data["staff_payout_brl"] = format_brl_from_cents(repasse_cents)
    return data


def _scoped_staff_order(actor, order_id: object) -> ServiceOrder:
    try:
        parsed_id = int(order_id)
    except (TypeError, ValueError) as exc:
        raise ValidationError("Pedido inválido.") from exc
    order = (
        scoped_query(ServiceOrder, actor)
        .filter(ServiceOrder.id == parsed_id, ServiceOrder.staff_user_id == actor.id)
        .first()
    )
    if order is None:
        raise NotFoundError("Pedido não encontrado para este funcionário.")
    return order


def get_staff_profile(actor) -> dict:
    return {
        "id": actor.id,
        "full_name": actor.full_name,
        "email": actor.email,
        "cpf": actor.cpf,
        "phone": actor.phone,
        "role": actor.role,
        "role_title": actor.role_title,
        "employee_code": actor.employee_code,
        "oab_number": actor.oab_number,
        "zip_code": actor.zip_code,
        "street": actor.street,
        "street_number": actor.street_number,
        "address_complement": actor.address_complement,
        "neighborhood": actor.neighborhood,
        "city": actor.city,
        "state": actor.state,
        "is_active": actor.is_active,
        "created_at": actor.created_at.isoformat(),
    }


def update_staff_profile(actor, payload: dict) -> dict:
    full_name = str(payload.get("full_name") or "").strip() if "full_name" in payload else None
    email = str(payload.get("email") or "").strip().lower() if "email" in payload else None

    if full_name is not None:
        if not full_name:
            raise ValidationError("Nome completo não pode ficar vazio.")
        actor.full_name = full_name

    if email is not None:
        if not email:
            raise ValidationError("E-mail não pode ficar vazio.")
        existing = User.query.filter(User.email == email, User.id != actor.id).first()
        if existing is not None:
            raise ConflictError("E-mail já está em uso por outro usuário.")
        actor.email = email

    for field in ("phone", "zip_code", "street", "street_number", "address_complement", "neighborhood", "city", "state"):
        if field in payload:
            value = str(payload.get(field) or "").strip()
            setattr(actor, field, value or None)

    log_action(action="staff.updated_profile", entity_type="user", entity_id=actor.id, user=actor)
    db.session.commit()
    return get_staff_profile(actor)


def list_staff_orders(actor) -> dict:
    orders = (
        scoped_query(ServiceOrder, actor)
        .filter(ServiceOrder.staff_user_id == actor.id)
        .order_by(ServiceOrder.deadline_at.asc().nullslast(), ServiceOrder.created_at.desc())
        .all()
    )
    return {"orders": [_serialize_order_for_staff(order) for order in orders]}


def update_staff_order(actor, order_id: object, payload: dict) -> dict:
    order = _scoped_staff_order(actor, order_id)
    status = payload.get("status")
    if status is not None:
        status = str(status).strip()
        if status not in {"pendente", "em_andamento", "concluido"}:
            raise ValidationError("Status inválido.")
        order.status = status
        if status == "concluido":
            order.completed_at = datetime.now(timezone.utc)
        elif "completed_at" in payload:
            order.completed_at = None

    log_action(action="staff.updated_order", entity_type="service_order", entity_id=order.id, user=actor)
    db.session.commit()
    return {"order": _serialize_order_for_staff(order)}


def get_staff_financial(actor) -> dict:
    orders = (
        scoped_query(ServiceOrder, actor)
        .filter(ServiceOrder.staff_user_id == actor.id)
        .order_by(ServiceOrder.created_at.desc())
        .all()
    )
    total_repasse = sum(int(order.total_amount * (order.split_funcionario / 100)) for order in orders)
    total_concluidos = sum(1 for order in orders if order.status == "concluido")
    return {
        "summary": {
            "total_orders": len(orders),
            "completed_orders": total_concluidos,
            "estimated_payout_cents": total_repasse,
            "estimated_payout_brl": format_brl_from_cents(total_repasse),
        },
        "orders": [_serialize_order_for_staff(order) for order in orders],
    }
