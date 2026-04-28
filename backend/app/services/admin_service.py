from __future__ import annotations

from datetime import datetime, timezone

from werkzeug.security import generate_password_hash

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.extensions import db
from app.domain.permissions import scoped_query
from app.models import FinancialEntry, Plan, ServiceCatalogItem, ServiceOrder, ServiceOrderItem, User
from app.services.audit_service import log_action
from app.services.serializers import format_brl_from_cents

_ORDER_STATUS_LABELS = {
    "pendente": "Em análise",
    "em_andamento": "Aguardando dados",
    "concluido": "Concluído",
}
_ORDER_STATUSES = {"pendente", "em_andamento", "concluido"}
_ENTRY_KINDS = {"credit", "debit"}


def _format_date(value) -> str:
    if value is None:
        return "—"
    return value.strftime("%d/%m/%Y")


def _format_datetime(value) -> str:
    if value is None:
        return "—"
    return value.strftime("%d/%m/%Y %H:%M")


def _parse_datetime(value: object, *, field_name: str) -> datetime | None:
    if value is None or str(value).strip() == "":
        return None
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"Campo '{field_name}' precisa estar em formato ISO-8601.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _to_int(value: object, *, field_name: str, minimum: int | None = None) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"Campo '{field_name}' inválido.") from exc
    if minimum is not None and parsed < minimum:
        raise ValidationError(f"Campo '{field_name}' deve ser >= {minimum}.")
    return parsed


def _status_label(status: str) -> str:
    return _ORDER_STATUS_LABELS.get(status, status.replace("_", " ").capitalize())


def _normalize_optional(payload: dict, key: str) -> str | None:
    if key not in payload:
        return None
    value = payload.get(key)
    if value is None:
        return ""
    return str(value).strip()


def _validate_split(split_plataforma: int, split_funcionario: int) -> None:
    if split_plataforma < 0 or split_funcionario < 0:
        raise ValidationError("Splits não podem ser negativos.")
    if split_plataforma + split_funcionario != 100:
        raise ValidationError("Split plataforma + split funcionário deve totalizar 100%.")


def _next_order_reference() -> str:
    return f"ADM-{ServiceOrder.query.count() + 1:06d}"


def _scoped_user(actor, user_id: object, *, role: str | None = None) -> User:
    parsed_id = _to_int(user_id, field_name="id")
    query = scoped_query(User, actor).filter(User.id == parsed_id)
    if role is not None:
        query = query.filter(User.role == role)
    user = query.first()
    if user is None:
        raise NotFoundError("Usuário não encontrado.")
    return user


def _scoped_order(actor, order_id: object) -> ServiceOrder:
    parsed_id = _to_int(order_id, field_name="id")
    order = scoped_query(ServiceOrder, actor).filter(ServiceOrder.id == parsed_id).first()
    if order is None:
        raise NotFoundError("Pedido não encontrado.")
    return order


def _serialize_order(order: ServiceOrder) -> dict:
    items = order.items or []
    item_titles = [item.title for item in items if item.title]
    tipo_servico = " · ".join(item_titles) if item_titles else "Serviço não informado"

    return {
        "id": order.id,
        "numero": order.reference,
        "cliente": order.user.full_name if order.user else "Cliente não identificado",
        "tipo_servico": tipo_servico,
        "status": order.status,
        "status_label": _status_label(order.status),
        "funcionario": order.staff_user.full_name if order.staff_user else None,
        "prazo_cliente": _format_date(order.deadline_at),
        "valor": order.total_amount,
        "valor_brl": format_brl_from_cents(order.total_amount),
        "criado_em": _format_datetime(order.created_at),
        "finalizado_em": _format_datetime(order.completed_at),
        "split_plataforma": order.split_plataforma,
        "split_funcionario": order.split_funcionario,
    }


def _serialize_client(user: User) -> dict:
    return {
        "id": user.id,
        "nome": user.full_name,
        "oab": user.oab_number or "—",
        "email": user.email,
        "telefone": user.phone or "—",
        "plano": user.active_plan.name if user.active_plan else "Sem plano",
        "cadastrado_em": _format_date(user.created_at),
        "ativo": user.is_active,
    }


def _serialize_staff(user: User, *, active_orders: int, completed_orders: int) -> dict:
    return {
        "id": user.id,
        "nome": user.full_name,
        "email": user.email,
        "telefone": user.phone or "—",
        "pedidos_ativos": active_orders,
        "pedidos_concluidos": completed_orders,
        "ativo": user.is_active,
    }


def _serialize_plan(plan: Plan) -> dict:
    return {
        "id": plan.id,
        "code": plan.code,
        "name": plan.name,
        "description": plan.description,
        "monthly_price_cents": plan.monthly_price_cents,
        "monthly_price_brl": format_brl_from_cents(plan.monthly_price_cents),
        "monthly_credits_cents": plan.monthly_credits_cents,
        "monthly_credits_brl": format_brl_from_cents(plan.monthly_credits_cents),
        "petition_limit_monthly": plan.petition_limit_monthly,
        "is_active": plan.is_active,
    }


def _serialize_entry(entry: FinancialEntry) -> dict:
    return {
        "id": entry.id,
        "description": entry.description,
        "kind": entry.kind,
        "amount_cents": entry.amount_cents,
        "amount_brl": format_brl_from_cents(entry.amount_cents),
        "occurred_at": entry.occurred_at.isoformat(),
        "occurred_at_label": _format_datetime(entry.occurred_at),
        "order_id": entry.order_id,
        "is_active": entry.is_active,
    }


def get_admin_profile(actor) -> dict:
    return {
        "id": actor.id,
        "full_name": actor.full_name,
        "email": actor.email,
        "oab_number": actor.oab_number,
        "cpf": actor.cpf,
        "phone": actor.phone,
        "role": actor.role,
        "role_title": actor.role_title,
        "employee_code": actor.employee_code,
        "zip_code": actor.zip_code,
        "street": actor.street,
        "street_number": actor.street_number,
        "address_complement": actor.address_complement,
        "neighborhood": actor.neighborhood,
        "city": actor.city,
        "state": actor.state,
        "is_active": actor.is_active,
        "created_at": actor.created_at.isoformat(),
        "created_at_label": _format_date(actor.created_at),
    }


def update_admin_profile(actor, payload: dict) -> dict:
    full_name = _normalize_optional(payload, "full_name")
    email = _normalize_optional(payload, "email")
    oab_number = _normalize_optional(payload, "oab_number")

    if full_name is not None:
        if not full_name:
            raise ValidationError("Nome completo não pode ficar vazio.")
        actor.full_name = full_name

    if email is not None:
        if not email:
            raise ValidationError("E-mail não pode ficar vazio.")
        existing = User.query.filter(User.email == email.lower(), User.id != actor.id).first()
        if existing is not None:
            raise ConflictError("E-mail já está em uso por outro usuário.")
        actor.email = email.lower()

    if oab_number is not None:
        actor.oab_number = oab_number or None

    for field in (
        "cpf",
        "phone",
        "role_title",
        "employee_code",
        "zip_code",
        "street",
        "street_number",
        "address_complement",
        "neighborhood",
        "city",
        "state",
    ):
        value = _normalize_optional(payload, field)
        if value is not None:
            setattr(actor, field, value or None)

    log_action(
        action="admin.updated_profile",
        entity_type="user",
        entity_id=actor.id,
        user=actor,
        metadata={"email": actor.email},
    )
    db.session.commit()
    return get_admin_profile(actor)


def list_admin_orders(actor) -> dict:
    orders = scoped_query(ServiceOrder, actor).order_by(ServiceOrder.created_at.desc()).all()
    return {"orders": [_serialize_order(order) for order in orders]}


def get_admin_order(actor, order_id: object) -> dict:
    order = _scoped_order(actor, order_id)
    return {"order": _serialize_order(order)}


def create_admin_order(actor, payload: dict) -> dict:
    user_id = payload.get("user_id")
    if user_id is None:
        raise ValidationError("Campo 'user_id' é obrigatório.")
    client = _scoped_user(actor, user_id, role="client")

    status = str(payload.get("status") or "pendente").strip()
    if status not in _ORDER_STATUSES:
        raise ValidationError("Status de pedido inválido.")

    split_plataforma = _to_int(payload.get("split_plataforma", 100), field_name="split_plataforma", minimum=0)
    split_funcionario = _to_int(payload.get("split_funcionario", 0), field_name="split_funcionario", minimum=0)
    _validate_split(split_plataforma, split_funcionario)

    staff_user_id = payload.get("staff_user_id")
    staff_user = _scoped_user(actor, staff_user_id, role="staff") if staff_user_id else None
    total_amount = _to_int(payload.get("valor", 0), field_name="valor", minimum=0)

    order = ServiceOrder(
        user_id=client.id,
        company_id=client.company_id,
        staff_user_id=getattr(staff_user, "id", None),
        reference=str(payload.get("numero") or _next_order_reference()).strip(),
        status=status,
        total_amount=total_amount,
        deadline_at=_parse_datetime(payload.get("prazo_cliente"), field_name="prazo_cliente"),
        completed_at=_parse_datetime(payload.get("finalizado_em"), field_name="finalizado_em"),
        split_plataforma=split_plataforma,
        split_funcionario=split_funcionario,
    )
    db.session.add(order)
    db.session.flush()

    service_title = str(payload.get("tipo_servico") or "Serviço administrativo").strip()
    db.session.add(
        ServiceOrderItem(
            order_id=order.id,
            company_id=order.company_id,
            code="admin-custom",
            title=service_title,
            quantity=1,
            unit_price=total_amount,
            line_total=total_amount,
        )
    )

    log_action(
        action="admin.order_created",
        entity_type="service_order",
        entity_id=order.id,
        user=actor,
        metadata={"status": order.status, "reference": order.reference},
    )
    db.session.commit()
    return {"order": _serialize_order(order)}


def update_admin_order(actor, order_id: object, payload: dict) -> dict:
    order = _scoped_order(actor, order_id)

    if "status" in payload:
        status = str(payload.get("status") or "").strip()
        if status not in _ORDER_STATUSES:
            raise ValidationError("Status de pedido inválido.")
        order.status = status

    if "valor" in payload:
        order.total_amount = _to_int(payload.get("valor"), field_name="valor", minimum=0)

    if "split_plataforma" in payload or "split_funcionario" in payload:
        split_plataforma = _to_int(
            payload.get("split_plataforma", order.split_plataforma),
            field_name="split_plataforma",
            minimum=0,
        )
        split_funcionario = _to_int(
            payload.get("split_funcionario", order.split_funcionario),
            field_name="split_funcionario",
            minimum=0,
        )
        _validate_split(split_plataforma, split_funcionario)
        order.split_plataforma = split_plataforma
        order.split_funcionario = split_funcionario

    if "staff_user_id" in payload:
        staff_user_id = payload.get("staff_user_id")
        order.staff_user_id = _scoped_user(actor, staff_user_id, role="staff").id if staff_user_id else None

    if "prazo_cliente" in payload:
        order.deadline_at = _parse_datetime(payload.get("prazo_cliente"), field_name="prazo_cliente")
    if "finalizado_em" in payload:
        order.completed_at = _parse_datetime(payload.get("finalizado_em"), field_name="finalizado_em")

    if "tipo_servico" in payload:
        title = str(payload.get("tipo_servico") or "").strip()
        if not title:
            raise ValidationError("Campo 'tipo_servico' inválido.")
        if order.items:
            order.items[0].title = title
        else:
            db.session.add(
                ServiceOrderItem(
                    order_id=order.id,
                    company_id=order.company_id,
                    code="admin-custom",
                    title=title,
                    quantity=1,
                    unit_price=order.total_amount,
                    line_total=order.total_amount,
                )
            )

    log_action(
        action="admin.order_updated",
        entity_type="service_order",
        entity_id=order.id,
        user=actor,
        metadata={"status": order.status},
    )
    db.session.commit()
    return {"order": _serialize_order(order)}


def delete_admin_order(actor, order_id: object) -> dict:
    order = _scoped_order(actor, order_id)
    db.session.delete(order)
    log_action(
        action="admin.order_deleted",
        entity_type="service_order",
        entity_id=order.id,
        user=actor,
    )
    db.session.commit()
    return {"deleted": True}


def _create_or_update_user(actor, payload: dict, *, role: str, user: User | None = None) -> User:
    full_name = str(payload.get("full_name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    if not full_name:
        raise ValidationError("Campo 'full_name' é obrigatório.")
    if not email:
        raise ValidationError("Campo 'email' é obrigatório.")

    query = User.query.filter_by(email=email)
    if user is not None:
        query = query.filter(User.id != user.id)
    if query.first() is not None:
        raise ConflictError("E-mail já está em uso.")

    if user is None:
        password = str(payload.get("password") or "").strip()
        if len(password) < 8:
            raise ValidationError("Campo 'password' é obrigatório e deve ter ao menos 8 caracteres.")
        user = User(
            full_name=full_name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            company_id=actor.company_id,
            is_active=True,
        )
        db.session.add(user)
    else:
        user.full_name = full_name
        user.email = email

    user.oab_number = _normalize_optional(payload, "oab_number") or user.oab_number
    user.phone = _normalize_optional(payload, "phone") or None
    user.cpf = _normalize_optional(payload, "cpf") or None
    user.role_title = _normalize_optional(payload, "role_title") or None
    user.employee_code = _normalize_optional(payload, "employee_code") or None
    if "is_active" in payload:
        user.is_active = bool(payload.get("is_active"))

    return user


def list_admin_clients(actor) -> dict:
    query = scoped_query(User, actor).filter(User.role == "client").order_by(User.created_at.desc())
    return {"clients": [_serialize_client(user) for user in query.all()]}


def get_admin_client(actor, client_id: object) -> dict:
    return {"client": _serialize_client(_scoped_user(actor, client_id, role="client"))}


def create_admin_client(actor, payload: dict) -> dict:
    user = _create_or_update_user(actor, payload, role="client")
    log_action(action="admin.client_created", entity_type="user", entity_id=user.id, user=actor)
    db.session.commit()
    return {"client": _serialize_client(user)}


def update_admin_client(actor, client_id: object, payload: dict) -> dict:
    user = _scoped_user(actor, client_id, role="client")
    _create_or_update_user(actor, payload, role="client", user=user)
    log_action(action="admin.client_updated", entity_type="user", entity_id=user.id, user=actor)
    db.session.commit()
    return {"client": _serialize_client(user)}


def delete_admin_client(actor, client_id: object) -> dict:
    user = _scoped_user(actor, client_id, role="client")
    user.is_active = False
    log_action(action="admin.client_deleted", entity_type="user", entity_id=user.id, user=actor)
    db.session.commit()
    return {"deleted": True}


def list_admin_staff(actor) -> dict:
    users = scoped_query(User, actor).filter(User.role == "staff").order_by(User.created_at.desc()).all()
    payload = []
    for user in users:
        active_orders = (
            scoped_query(ServiceOrder, actor)
            .filter(ServiceOrder.staff_user_id == user.id, ServiceOrder.status != "concluido")
            .count()
        )
        completed_orders = (
            scoped_query(ServiceOrder, actor)
            .filter(ServiceOrder.staff_user_id == user.id, ServiceOrder.status == "concluido")
            .count()
        )
        payload.append(_serialize_staff(user, active_orders=active_orders, completed_orders=completed_orders))
    return {"staff": payload}


def get_admin_staff_member(actor, staff_id: object) -> dict:
    user = _scoped_user(actor, staff_id, role="staff")
    active_orders = (
        scoped_query(ServiceOrder, actor)
        .filter(ServiceOrder.staff_user_id == user.id, ServiceOrder.status != "concluido")
        .count()
    )
    completed_orders = (
        scoped_query(ServiceOrder, actor)
        .filter(ServiceOrder.staff_user_id == user.id, ServiceOrder.status == "concluido")
        .count()
    )
    return {"staff_member": _serialize_staff(user, active_orders=active_orders, completed_orders=completed_orders)}


def create_admin_staff(actor, payload: dict) -> dict:
    user = _create_or_update_user(actor, payload, role="staff")
    log_action(action="admin.staff_created", entity_type="user", entity_id=user.id, user=actor)
    db.session.commit()
    return {"staff_member": _serialize_staff(user, active_orders=0, completed_orders=0)}


def update_admin_staff(actor, staff_id: object, payload: dict) -> dict:
    user = _scoped_user(actor, staff_id, role="staff")
    _create_or_update_user(actor, payload, role="staff", user=user)
    active_orders = (
        scoped_query(ServiceOrder, actor)
        .filter(ServiceOrder.staff_user_id == user.id, ServiceOrder.status != "concluido")
        .count()
    )
    completed_orders = (
        scoped_query(ServiceOrder, actor)
        .filter(ServiceOrder.staff_user_id == user.id, ServiceOrder.status == "concluido")
        .count()
    )
    log_action(action="admin.staff_updated", entity_type="user", entity_id=user.id, user=actor)
    db.session.commit()
    return {
        "staff_member": _serialize_staff(user, active_orders=active_orders, completed_orders=completed_orders)
    }


def delete_admin_staff(actor, staff_id: object) -> dict:
    user = _scoped_user(actor, staff_id, role="staff")
    user.is_active = False
    log_action(action="admin.staff_deleted", entity_type="user", entity_id=user.id, user=actor)
    db.session.commit()
    return {"deleted": True}


def get_admin_financial(actor) -> dict:
    orders = scoped_query(ServiceOrder, actor).order_by(ServiceOrder.created_at.desc()).all()
    entries = (
        scoped_query(FinancialEntry, actor)
        .filter(FinancialEntry.is_active.is_(True))
        .order_by(FinancialEntry.occurred_at.desc())
        .all()
    )

    receita_pedidos = sum(order.total_amount for order in orders)
    creditos = sum(entry.amount_cents for entry in entries if entry.kind == "credit")
    debitos = sum(entry.amount_cents for entry in entries if entry.kind == "debit")
    receita_mes = receita_pedidos + creditos - debitos
    concluidos = sum(1 for order in orders if order.status == "concluido")
    abertos = len(orders) - concluidos

    return {
        "stats": {
            "receita_mes": receita_mes,
            "receita_mes_brl": format_brl_from_cents(receita_mes),
            "concluidos": concluidos,
            "abertos": abertos,
        },
        "orders": [_serialize_order(order) for order in orders],
        "entries": [_serialize_entry(entry) for entry in entries],
    }


def list_financial_entries(actor) -> dict:
    entries = (
        scoped_query(FinancialEntry, actor)
        .filter(FinancialEntry.is_active.is_(True))
        .order_by(FinancialEntry.occurred_at.desc())
        .all()
    )
    return {"entries": [_serialize_entry(entry) for entry in entries]}


def get_financial_entry(actor, entry_id: object) -> dict:
    parsed_id = _to_int(entry_id, field_name="id")
    entry = scoped_query(FinancialEntry, actor).filter(FinancialEntry.id == parsed_id).first()
    if entry is None or not entry.is_active:
        raise NotFoundError("Lançamento financeiro não encontrado.")
    return {"entry": _serialize_entry(entry)}


def create_financial_entry(actor, payload: dict) -> dict:
    description = str(payload.get("description") or "").strip()
    if not description:
        raise ValidationError("Campo 'description' é obrigatório.")
    kind = str(payload.get("kind") or "credit").strip().lower()
    if kind not in _ENTRY_KINDS:
        raise ValidationError("Campo 'kind' inválido.")

    amount_cents = _to_int(payload.get("amount_cents", 0), field_name="amount_cents", minimum=0)
    entry = FinancialEntry(
        description=description,
        kind=kind,
        amount_cents=amount_cents,
        occurred_at=_parse_datetime(payload.get("occurred_at"), field_name="occurred_at") or datetime.now(timezone.utc),
        company_id=actor.company_id,
        created_by_user_id=actor.id,
        is_active=True,
    )
    db.session.add(entry)
    log_action(action="admin.financial_entry_created", entity_type="financial_entry", entity_id=entry.id, user=actor)
    db.session.commit()
    return {"entry": _serialize_entry(entry)}


def update_financial_entry(actor, entry_id: object, payload: dict) -> dict:
    parsed_id = _to_int(entry_id, field_name="id")
    entry = scoped_query(FinancialEntry, actor).filter(FinancialEntry.id == parsed_id).first()
    if entry is None or not entry.is_active:
        raise NotFoundError("Lançamento financeiro não encontrado.")

    if "description" in payload:
        description = str(payload.get("description") or "").strip()
        if not description:
            raise ValidationError("Campo 'description' inválido.")
        entry.description = description
    if "kind" in payload:
        kind = str(payload.get("kind") or "").strip().lower()
        if kind not in _ENTRY_KINDS:
            raise ValidationError("Campo 'kind' inválido.")
        entry.kind = kind
    if "amount_cents" in payload:
        entry.amount_cents = _to_int(payload.get("amount_cents"), field_name="amount_cents", minimum=0)
    if "occurred_at" in payload:
        entry.occurred_at = _parse_datetime(payload.get("occurred_at"), field_name="occurred_at")

    log_action(action="admin.financial_entry_updated", entity_type="financial_entry", entity_id=entry.id, user=actor)
    db.session.commit()
    return {"entry": _serialize_entry(entry)}


def delete_financial_entry(actor, entry_id: object) -> dict:
    parsed_id = _to_int(entry_id, field_name="id")
    entry = scoped_query(FinancialEntry, actor).filter(FinancialEntry.id == parsed_id).first()
    if entry is None or not entry.is_active:
        raise NotFoundError("Lançamento financeiro não encontrado.")
    entry.is_active = False
    log_action(action="admin.financial_entry_deleted", entity_type="financial_entry", entity_id=entry.id, user=actor)
    db.session.commit()
    return {"deleted": True}


def list_admin_plans(actor) -> dict:
    del actor

    plans = Plan.query.order_by(Plan.monthly_price_cents.asc()).all()
    avulsos = ServiceCatalogItem.query.order_by(ServiceCatalogItem.section.asc(), ServiceCatalogItem.title.asc()).all()

    return {
        "plans": [_serialize_plan(plan) for plan in plans],
        "single_services": [
            {
                "id": service.id,
                "code": service.code,
                "section": service.section,
                "title": service.title,
                "unit_price": service.unit_price,
                "unit_price_brl": format_brl_from_cents(service.unit_price),
                "is_active": service.is_active,
            }
            for service in avulsos
        ],
    }


def get_admin_plan(plan_id: object) -> dict:
    parsed_id = _to_int(plan_id, field_name="id")
    plan = db.session.get(Plan, parsed_id)
    if plan is None:
        raise NotFoundError("Plano não encontrado.")
    return {"plan": _serialize_plan(plan)}


def create_admin_plan(actor, payload: dict) -> dict:
    code = str(payload.get("code") or "").strip().lower()
    name = str(payload.get("name") or "").strip()
    if not code:
        raise ValidationError("Campo 'code' é obrigatório.")
    if not name:
        raise ValidationError("Campo 'name' é obrigatório.")
    if Plan.query.filter_by(code=code).first() is not None:
        raise ConflictError("Já existe plano com este código.")

    plan = Plan(
        code=code,
        name=name,
        description=str(payload.get("description") or "").strip() or None,
        monthly_price_cents=_to_int(payload.get("monthly_price_cents", 0), field_name="monthly_price_cents", minimum=0),
        monthly_credits_cents=_to_int(
            payload.get("monthly_credits_cents", 0), field_name="monthly_credits_cents", minimum=0
        ),
        petition_limit_monthly=(
            _to_int(payload.get("petition_limit_monthly"), field_name="petition_limit_monthly", minimum=0)
            if payload.get("petition_limit_monthly") is not None
            else None
        ),
        is_active=bool(payload.get("is_active", True)),
    )
    db.session.add(plan)
    log_action(action="admin.plan_created", entity_type="plan", entity_id=code, user=actor)
    db.session.commit()
    return {"plan": _serialize_plan(plan)}


def update_admin_plan(actor, plan_id: object, payload: dict) -> dict:
    parsed_id = _to_int(plan_id, field_name="id")
    plan = db.session.get(Plan, parsed_id)
    if plan is None:
        raise NotFoundError("Plano não encontrado.")

    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise ValidationError("Campo 'name' inválido.")
        plan.name = name
    if "description" in payload:
        plan.description = str(payload.get("description") or "").strip() or None
    if "monthly_price_cents" in payload:
        plan.monthly_price_cents = _to_int(payload.get("monthly_price_cents"), field_name="monthly_price_cents", minimum=0)
    if "monthly_credits_cents" in payload:
        plan.monthly_credits_cents = _to_int(
            payload.get("monthly_credits_cents"), field_name="monthly_credits_cents", minimum=0
        )
    if "petition_limit_monthly" in payload:
        plan.petition_limit_monthly = (
            _to_int(payload.get("petition_limit_monthly"), field_name="petition_limit_monthly", minimum=0)
            if payload.get("petition_limit_monthly") is not None
            else None
        )
    if "is_active" in payload:
        plan.is_active = bool(payload.get("is_active"))

    log_action(action="admin.plan_updated", entity_type="plan", entity_id=plan.id, user=actor)
    db.session.commit()
    return {"plan": _serialize_plan(plan)}


def delete_admin_plan(actor, plan_id: object) -> dict:
    parsed_id = _to_int(plan_id, field_name="id")
    plan = db.session.get(Plan, parsed_id)
    if plan is None:
        raise NotFoundError("Plano não encontrado.")
    plan.is_active = False
    log_action(action="admin.plan_deleted", entity_type="plan", entity_id=plan.id, user=actor)
    db.session.commit()
    return {"deleted": True}
