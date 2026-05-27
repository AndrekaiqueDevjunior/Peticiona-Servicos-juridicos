from __future__ import annotations

from datetime import datetime, timezone

from werkzeug.security import generate_password_hash

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.extensions import db
from app.domain.permissions import scoped_query
from app.models import CreditPurchase, CreditTransaction, FinancialEntry, Order, PetitionParty, Plan, ServiceCatalogItem, ServiceOrder, ServiceOrderItem, User
from app.services.audit_service import log_action
from app.services.pagarme_service import PagarmeClient
from app.services.serializers import format_brl_from_cents, serialize_petition

_ORDER_STATUS_LABELS = {
    "pendente": "Em análise",
    "em_andamento": "Aguardando dados",
    "concluido": "Concluído",
    "cancelado": "Cancelado",
}
_ORDER_STATUSES = {"pendente", "em_andamento", "concluido", "cancelado"}
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


def _placeholder_admin_order_reference() -> str:
    """Placeholder único pra reference enquanto o INSERT acontece.

    A reference humana definitiva (``ADM-NNNNNN``) é atribuída
    *depois* do flush, derivada do ``order.id`` (atômico no banco).
    Substitui ``_next_order_reference`` que usava
    ``ServiceOrder.query.count() + 1`` e colidia sob concorrência.
    """
    from app.core.references import temporary_reference

    return temporary_reference("ADM")


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
        "user_id": order.user_id,
        "cliente": order.user.full_name if order.user else "Cliente não identificado",
        "petition_id": order.petition_id,
        "petition": serialize_petition(order.petition) if order.petition else None,
        "staff_user_id": order.staff_user_id,
        "tipo_servico": tipo_servico,
        "status": order.status,
        "status_label": _status_label(order.status),
        "funcionario": order.staff_user.full_name if order.staff_user else None,
        "prazo_cliente": _format_date(order.deadline_at),
        "prazo_cliente_iso": order.deadline_at.isoformat() if order.deadline_at else None,
        "valor": order.total_amount,
        "valor_brl": format_brl_from_cents(order.total_amount),
        "criado_em": _format_datetime(order.created_at),
        "criado_em_iso": order.created_at.isoformat() if order.created_at else None,
        "finalizado_em": _format_datetime(order.completed_at),
        "finalizado_em_iso": order.completed_at.isoformat() if order.completed_at else None,
        "split_plataforma": order.split_plataforma,
        "split_funcionario": order.split_funcionario,
    }


def _split_oab(oab_number):
    if not oab_number:
        return None, None
    parts = str(oab_number).rsplit("/", 1)
    if len(parts) == 2 and len(parts[1].strip()) == 2 and parts[1].strip().isalpha():
        return parts[0].strip() or None, parts[1].strip().upper()
    return str(oab_number).strip() or None, None


def _format_cpf(cpf):
    if not cpf:
        return None
    digits = "".join(ch for ch in str(cpf) if ch.isdigit())
    if len(digits) != 11:
        return cpf
    return f"{digits[0:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:11]}"


def _format_phone(phone):
    if not phone:
        return None
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) == 11:
        return f"({digits[0:2]}) {digits[2:7]}-{digits[7:11]}"
    if len(digits) == 10:
        return f"({digits[0:2]}) {digits[2:6]}-{digits[6:10]}"
    return phone


def _serialize_client(user: User) -> dict:
    oab_num, oab_uf = _split_oab(user.oab_number)
    return {
        "id": user.id,
        "nome": user.full_name,
        "full_name": user.full_name,
        "oab": user.oab_number or "—",
        "oab_number": oab_num,
        "oab_uf": oab_uf,
        "email": user.email,
        "telefone": user.phone or "—",
        "telefone_formatado": _format_phone(user.phone) or "—",
        "phone": user.phone,
        "cpf": user.cpf,
        "cpf_formatado": _format_cpf(user.cpf) or "—",
        "role_title": user.role_title,
        "employee_code": user.employee_code,
        "zip_code": user.zip_code,
        "street": user.street,
        "street_number": user.street_number,
        "address_complement": user.address_complement,
        "neighborhood": user.neighborhood,
        "city": user.city,
        "state": user.state,
        "active_plan_id": user.active_plan_id,
        "plano": user.active_plan.name if user.active_plan else "Sem plano",
        "cadastrado_em": _format_date(user.created_at),
        "cadastrado_em_iso": user.created_at.isoformat() if user.created_at else None,
        "ativo": user.is_active,
    }


def _serialize_staff(user: User, *, active_orders: int, completed_orders: int) -> dict:
    return {
        "id": user.id,
        "nome": user.full_name,
        "full_name": user.full_name,
        "email": user.email,
        "telefone": user.phone or "—",
        "telefone_formatado": _format_phone(user.phone) or "—",
        "phone": user.phone,
        "oab": user.oab_number,
        "cpf": user.cpf,
        "role_title": user.role_title,
        "employee_code": user.employee_code,
        "zip_code": user.zip_code,
        "street": user.street,
        "street_number": user.street_number,
        "address_complement": user.address_complement,
        "neighborhood": user.neighborhood,
        "city": user.city,
        "state": user.state,
        "pedidos_ativos": active_orders,
        "pedidos_concluidos": completed_orders,
        "ativo": user.is_active,
    }


def _serialize_plan(plan: Plan) -> dict:
    import json as _json
    features: list = []
    if getattr(plan, "features_json", None):
        try:
            features = _json.loads(plan.features_json)
        except Exception:
            features = []
    credits_qty = int(getattr(plan, "credits_quantity", None) or 0)
    price = int(plan.monthly_price_cents or 0)
    price_per_credit = (price // credits_qty) if credits_qty > 0 else None
    return {
        "id": plan.id,
        "code": plan.code,
        "name": plan.name,
        "description": plan.description,
        "monthly_price_cents": plan.monthly_price_cents,
        "monthly_price_brl": format_brl_from_cents(plan.monthly_price_cents),
        "credits_quantity": credits_qty or None,
        "price_per_credit_cents": price_per_credit,
        "price_per_credit_brl": format_brl_from_cents(price_per_credit) if price_per_credit else None,
        "validity_days": int(getattr(plan, "validity_days", None) or 365),
        # legacy — mantidos para compatibilidade com código existente
        "monthly_credits_cents": plan.monthly_credits_cents,
        "monthly_credits_brl": format_brl_from_cents(plan.monthly_credits_cents),
        "petition_limit_monthly": plan.petition_limit_monthly,
        "price_per_service_cents": getattr(plan, "price_per_service_cents", None),
        "features": features,
        "is_highlighted": bool(getattr(plan, "is_highlighted", False)),
        "cta_label": getattr(plan, "cta_label", None) or f"Adquirir {plan.name}",
        "is_active": plan.is_active,
    }


def _serialize_service(service: ServiceCatalogItem) -> dict:
    return {
        "id": service.id,
        "code": service.code,
        "section": service.section,
        "title": service.title,
        "description": service.description,
        "unit_price": service.unit_price,
        "unit_price_brl": format_brl_from_cents(service.unit_price),
        "delivery_label": getattr(service, "delivery_label", None),
        "is_active": service.is_active,
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
    # Mantém paridade com `serialize_user` (frontend tipa todo perfil
    # de usuário como `AuthUser`, que inclui active_plan_id opcional).
    # Para admin/staff o campo é sempre None mas precisa existir pra
    # evitar undefined no consumidor.
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
        "active_plan_id": getattr(actor, "active_plan_id", None),
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

    from app.core.references import human_reference

    admin_provided_ref = str(payload.get("numero") or "").strip()
    order = ServiceOrder(
        user_id=client.id,
        company_id=client.company_id,
        staff_user_id=getattr(staff_user, "id", None),
        reference=admin_provided_ref or _placeholder_admin_order_reference(),
        status=status,
        total_amount=total_amount,
        deadline_at=_parse_datetime(payload.get("prazo_cliente"), field_name="prazo_cliente"),
        completed_at=_parse_datetime(payload.get("finalizado_em"), field_name="finalizado_em"),
        split_plataforma=split_plataforma,
        split_funcionario=split_funcionario,
    )
    db.session.add(order)
    db.session.flush()
    # Quando o admin não informa "numero", o placeholder é substituído
    # pela reference humana derivada do id já atômico.
    if not admin_provided_ref:
        order.reference = human_reference("ADM", order.id)
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


def _update_order_petition(actor, order: ServiceOrder, payload: dict) -> None:
    petition_payload = payload.get("petition")
    if not isinstance(petition_payload, dict):
        return

    petition = order.petition
    if petition is None:
        raise ValidationError("Pedido não possui petição vinculada para edição.")

    if "area_direito" in petition_payload:
        area = str(petition_payload.get("area_direito") or "").strip()
        if not area:
            raise ValidationError("Campo 'petition.area_direito' é obrigatório.")
        petition.area_direito = area

    for field in (
        "tipo_peticao",
        "numero_processo",
        "data_publicacao",
        "advogado_subscritor",
        "resumo_caso",
        "detalhes",
    ):
        if field in petition_payload:
            petition_value = petition_payload.get(field)
            petition_value = str(petition_value).strip() if petition_value is not None else ""
            setattr(petition, field, petition_value or None)

    for field in ("justica_gratuita", "tutela_urgencia"):
        if field in petition_payload:
            setattr(petition, field, bool(petition_payload.get(field)))

    if "partes" in petition_payload:
        parties = petition_payload.get("partes") or []
        if not isinstance(parties, list):
            raise ValidationError("Campo 'petition.partes' inválido.")

        petition.parties.clear()
        for raw_party in parties:
            if not isinstance(raw_party, dict):
                raise ValidationError("Cada parte deve ser um objeto.")
            nome = str(raw_party.get("nome") or "").strip()
            tipo = str(raw_party.get("tipo") or "").strip()
            if not nome or not tipo:
                raise ValidationError("Cada parte precisa de 'nome' e 'tipo'.")
            petition.parties.append(
                PetitionParty(
                    nome=nome,
                    tipo=tipo,
                    company_id=order.company_id or getattr(actor, "company_id", None),
                )
            )


def update_admin_order(actor, order_id: object, payload: dict) -> dict:
    payload = dict(payload or {})
    if "deadline_at" in payload and "prazo_cliente" not in payload:
        payload["prazo_cliente"] = payload.get("deadline_at")

    order = _scoped_order(actor, order_id)

    if "numero" in payload:
        reference = str(payload.get("numero") or "").strip()
        if not reference:
            raise ValidationError("Campo 'numero' inválido.")
        existing = ServiceOrder.query.filter(ServiceOrder.reference == reference, ServiceOrder.id != order.id).first()
        if existing is not None:
            raise ConflictError("Já existe pedido com esta referência.")
        order.reference = reference

    if "user_id" in payload:
        user_id = payload.get("user_id")
        if user_id is None:
            order.user_id = None
        else:
            client = _scoped_user(actor, user_id, role="client")
            order.user_id = client.id
            order.company_id = client.company_id
            if order.petition is not None:
                order.petition.user_id = client.id
                order.petition.company_id = client.company_id

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

    _update_order_petition(actor, order, payload)

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
    if user is None:
        full_name = str(payload.get("full_name") or "").strip()
        email = str(payload.get("email") or "").strip().lower()
        if not full_name:
            raise ValidationError("Campo 'full_name' é obrigatório.")
        if not email:
            raise ValidationError("Campo 'email' é obrigatório.")
        if User.query.filter_by(email=email).first() is not None:
            raise ConflictError("E-mail já está em uso.")

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
        if "full_name" in payload:
            full_name = str(payload.get("full_name") or "").strip()
            if not full_name:
                raise ValidationError("Campo 'full_name' é obrigatório.")
            user.full_name = full_name

        if "email" in payload:
            email = str(payload.get("email") or "").strip().lower()
            if not email:
                raise ValidationError("Campo 'email' é obrigatório.")
            query = User.query.filter_by(email=email).filter(User.id != user.id)
            if query.first() is not None:
                raise ConflictError("E-mail já está em uso.")
            user.email = email

        # Senha opcional no update: só altera se o admin enviou um valor não vazio.
        if "password" in payload:
            password = str(payload.get("password") or "").strip()
            if password:
                if len(password) < 8:
                    raise ValidationError("Senha deve ter pelo menos 8 caracteres.")
                user.password_hash = generate_password_hash(password)

    for field in (
        "phone",
        "cpf",
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
            setattr(user, field, value.upper()[:2] if field == "state" and value else value or None)

    if "active_plan_id" in payload:
        active_plan_id = payload.get("active_plan_id")
        if active_plan_id is None or str(active_plan_id).strip() == "":
            user.active_plan_id = None
        else:
            parsed_plan_id = _to_int(active_plan_id, field_name="active_plan_id")
            if db.session.get(Plan, parsed_plan_id) is None:
                raise NotFoundError("Plano não encontrado.")
            user.active_plan_id = parsed_plan_id

    # Aceita "oab_number" combinado ("12345/SP") ou separado ("oab" + "oab_uf").
    if "oab_number" in payload:
        value = _normalize_optional(payload, "oab_number")
        if value is not None:
            user.oab_number = value or None
    elif "oab" in payload or "oab_uf" in payload:
        oab_raw = _normalize_optional(payload, "oab")
        uf_raw = _normalize_optional(payload, "oab_uf")
        existing_num, existing_uf = _split_oab(user.oab_number)
        oab_part = (oab_raw if oab_raw is not None else (existing_num or "")).strip()
        uf_part = (uf_raw if uf_raw is not None else (existing_uf or "")).strip().upper()[:2]
        if oab_part and uf_part:
            user.oab_number = f"{oab_part}/{uf_part}"
        elif oab_part:
            user.oab_number = oab_part
        else:
            user.oab_number = None

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


def create_financial_refund(actor, payload: dict) -> dict:
    order_id = payload.get("order_id")
    if order_id is None:
        raise ValidationError("Campo 'order_id' é obrigatório.")
    order = _scoped_order(actor, order_id)

    amount_cents = _to_int(
        payload.get("amount_cents", order.total_amount),
        field_name="amount_cents",
        minimum=1,
    )
    if amount_cents > order.total_amount:
        raise ValidationError("Reembolso não pode exceder o valor do pedido.")

    reason = str(payload.get("reason") or payload.get("description") or "").strip()
    if not reason:
        raise ValidationError("Campo 'reason' é obrigatório.")

    entry = FinancialEntry(
        description=f"Reembolso: {reason}",
        kind="debit",
        amount_cents=amount_cents,
        occurred_at=datetime.now(timezone.utc),
        company_id=actor.company_id,
        order_id=order.id,
        created_by_user_id=actor.id,
        is_active=True,
    )
    db.session.add(entry)
    db.session.flush()
    
    # Estornar créditos para o cliente. idempotency_key inclui o id do
    # FinancialEntry recém-criado, então o mesmo lançamento de estorno
    # nunca duplica o crédito — substitui o filtro por LIKE %order.reference%
    # do código antigo, que falhava em estornos parciais sucessivos
    # (mesma referência, valores distintos).
    if order.user_id and amount_cents > 0:
        from app.services import credit_ledger

        order_owner = db.session.get(User, order.user_id)
        if order_owner is not None:
            credit_ledger.credit(
                order_owner,
                amount=amount_cents,
                source="admin_refund",
                description=f"Estorno — {order.reference} ({reason})",
                idempotency_key=f"admin-refund-{entry.id}",
                company_id=order.company_id,
            )
    
    log_action(
        action="admin.financial_refund_created",
        entity_type="financial_entry",
        entity_id=entry.id,
        user=actor,
        metadata={"order_id": order.id, "amount_cents": amount_cents},
    )
    db.session.commit()
    return {"refund": _serialize_entry(entry)}


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
        "single_services": [_serialize_service(service) for service in avulsos],
    }


def list_admin_services(actor) -> dict:
    del actor
    services = (
        ServiceCatalogItem.query
        .order_by(ServiceCatalogItem.section.asc(), ServiceCatalogItem.title.asc())
        .all()
    )
    return {"services": [_serialize_service(service) for service in services]}


def get_admin_service(service_id: object) -> dict:
    parsed_id = _to_int(service_id, field_name="id")
    service = db.session.get(ServiceCatalogItem, parsed_id)
    if service is None:
        raise NotFoundError("Serviço avulso não encontrado.")
    return {"service": _serialize_service(service)}


def create_admin_service(actor, payload: dict) -> dict:
    code = str(payload.get("code") or "").strip().lower()
    section = str(payload.get("section") or "").strip()
    title = str(payload.get("title") or "").strip()
    if not code:
        raise ValidationError("Campo 'code' é obrigatório.")
    if not section:
        raise ValidationError("Campo 'section' é obrigatório.")
    if not title:
        raise ValidationError("Campo 'title' é obrigatório.")
    if ServiceCatalogItem.query.filter_by(code=code).first() is not None:
        raise ConflictError("Já existe serviço com este código.")

    service = ServiceCatalogItem(
        code=code,
        section=section,
        title=title,
        description=str(payload.get("description") or "").strip() or None,
        unit_price=_to_int(payload.get("unit_price", 0), field_name="unit_price", minimum=0),
        delivery_label=(str(payload.get("delivery_label") or "").strip() or None),
        is_active=bool(payload.get("is_active", True)),
    )
    db.session.add(service)
    log_action(action="admin.service_created", entity_type="service_catalog_item", entity_id=code, user=actor)
    db.session.commit()
    return {"service": _serialize_service(service)}


def update_admin_service(actor, service_id: object, payload: dict) -> dict:
    parsed_id = _to_int(service_id, field_name="id")
    service = db.session.get(ServiceCatalogItem, parsed_id)
    if service is None:
        raise NotFoundError("Serviço avulso não encontrado.")

    if "section" in payload:
        section = str(payload.get("section") or "").strip()
        if not section:
            raise ValidationError("Campo 'section' inválido.")
        service.section = section
    if "title" in payload:
        title = str(payload.get("title") or "").strip()
        if not title:
            raise ValidationError("Campo 'title' inválido.")
        service.title = title
    if "description" in payload:
        service.description = str(payload.get("description") or "").strip() or None
    if "unit_price" in payload:
        service.unit_price = _to_int(payload.get("unit_price"), field_name="unit_price", minimum=0)
    if "delivery_label" in payload:
        service.delivery_label = str(payload.get("delivery_label") or "").strip() or None
    if "is_active" in payload:
        service.is_active = bool(payload.get("is_active"))

    log_action(action="admin.service_updated", entity_type="service_catalog_item", entity_id=service.id, user=actor)
    db.session.commit()
    return {"service": _serialize_service(service)}


def delete_admin_service(actor, service_id: object) -> dict:
    parsed_id = _to_int(service_id, field_name="id")
    service = db.session.get(ServiceCatalogItem, parsed_id)
    if service is None:
        raise NotFoundError("Serviço avulso não encontrado.")
    service.is_active = False
    log_action(action="admin.service_deleted", entity_type="service_catalog_item", entity_id=service.id, user=actor)
    db.session.commit()
    return {"deleted": True}


def get_admin_plan(plan_id: object) -> dict:
    parsed_id = _to_int(plan_id, field_name="id")
    plan = db.session.get(Plan, parsed_id)
    if plan is None:
        raise NotFoundError("Plano não encontrado.")
    return {"plan": _serialize_plan(plan)}


#: Limite de quantos centavos de saldo um plano pode dar por centavo cobrado.
#: 2.0 = promoção "ganhe 100% extra" ainda passa; valores maiores indicam
#: provavelmente erro de digitação (R$ 1 pagando R$ 1.000.000 em saldo). Sem
#: este teto, admin descuidado consegue criar plano que infla saldo de
#: cliente sem cobertura financeira correspondente.
MAX_PLAN_CREDIT_TO_PRICE_RATIO = 2.0


def _validate_plan_credit_ratio(monthly_price_cents: int, monthly_credits_cents: int) -> None:
    """Recusa planos onde o saldo creditado é múltiplos do preço pago.

    Promoção legítima (e.g. R$ 100 paga R$ 150 em crédito → ratio 1.5)
    passa. Erro grosseiro (R$ 1 paga R$ 999.999.999 em crédito) é
    bloqueado antes de virar fraude. Quando o preço é 0 (plano grátis),
    qualquer crédito > 0 é bloqueado também — não há cobertura financeira.
    """
    if monthly_credits_cents <= 0:
        return
    if monthly_price_cents <= 0:
        raise ValidationError(
            "Plano sem preço (monthly_price_cents=0) não pode dar crédito. "
            "Configure o preço primeiro ou zere monthly_credits_cents."
        )
    ratio = monthly_credits_cents / monthly_price_cents
    if ratio > MAX_PLAN_CREDIT_TO_PRICE_RATIO:
        raise ValidationError(
            f"monthly_credits_cents ({monthly_credits_cents}) excede o teto de "
            f"{MAX_PLAN_CREDIT_TO_PRICE_RATIO}x o monthly_price_cents "
            f"({monthly_price_cents}). Ratio atual: {ratio:.2f}x — provável "
            f"erro de digitação."
        )


def create_admin_plan(actor, payload: dict) -> dict:
    code = str(payload.get("code") or "").strip().lower()
    name = str(payload.get("name") or "").strip()
    if not code:
        raise ValidationError("Campo 'code' é obrigatório.")
    if not name:
        raise ValidationError("Campo 'name' é obrigatório.")
    if Plan.query.filter_by(code=code).first() is not None:
        raise ConflictError("Já existe plano com este código.")

    monthly_price_cents_value = _to_int(
        payload.get("monthly_price_cents", 0),
        field_name="monthly_price_cents",
        minimum=0,
    )
    # Quando o admin não informa explicitamente o crédito mensal, mantemos
    # paridade 1:1 com o preço pago — caso contrário a compra do plano não
    # gera saldo nenhum para o cliente.
    monthly_credits_default = (
        monthly_price_cents_value
        if payload.get("monthly_credits_cents") in (None, "", 0, "0")
        else payload.get("monthly_credits_cents")
    )
    monthly_credits_value = _to_int(
        monthly_credits_default, field_name="monthly_credits_cents", minimum=0
    )
    _validate_plan_credit_ratio(monthly_price_cents_value, monthly_credits_value)
    credits_qty = (
        _to_int(payload.get("credits_quantity"), field_name="credits_quantity", minimum=0)
        if payload.get("credits_quantity") is not None
        else None
    )
    validity = (
        _to_int(payload.get("validity_days"), field_name="validity_days", minimum=1)
        if payload.get("validity_days") is not None
        else 365
    )
    plan = Plan(
        code=code,
        name=name,
        description=str(payload.get("description") or "").strip() or None,
        monthly_price_cents=monthly_price_cents_value,
        monthly_credits_cents=monthly_credits_value,
        credits_quantity=credits_qty,
        validity_days=validity,
        petition_limit_monthly=credits_qty or (
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
    # Após aplicar ambos os campos (ou só um), valida o ratio. Cobre
    # tanto "atualizou price e esqueceu credits" quanto "atualizou
    # credits sem rever price" — qualquer caminho que deixe o plano
    # fora do limite é recusado.
    _validate_plan_credit_ratio(plan.monthly_price_cents, plan.monthly_credits_cents)
    if "petition_limit_monthly" in payload:
        plan.petition_limit_monthly = (
            _to_int(payload.get("petition_limit_monthly"), field_name="petition_limit_monthly", minimum=0)
            if payload.get("petition_limit_monthly") is not None
            else None
        )
    if "is_active" in payload:
        plan.is_active = bool(payload.get("is_active"))
    if "price_per_service_cents" in payload:
        plan.price_per_service_cents = (
            _to_int(payload.get("price_per_service_cents"), field_name="price_per_service_cents", minimum=0)
            if payload.get("price_per_service_cents") is not None
            else None
        )
    if "credits_quantity" in payload and payload.get("credits_quantity") is not None:
        cq = _to_int(payload.get("credits_quantity"), field_name="credits_quantity", minimum=0)
        plan.credits_quantity = cq
        # Mantém backward compat: petition_limit sobe junto
        plan.petition_limit_monthly = cq or plan.petition_limit_monthly
    if "validity_days" in payload and payload.get("validity_days") is not None:
        plan.validity_days = _to_int(payload.get("validity_days"), field_name="validity_days", minimum=1)
    if "is_highlighted" in payload:
        plan.is_highlighted = bool(payload.get("is_highlighted"))
    if "cta_label" in payload:
        plan.cta_label = str(payload.get("cta_label") or "").strip() or None
    if "features" in payload:
        import json as _json
        features = payload.get("features")
        if isinstance(features, list):
            plan.features_json = _json.dumps(
                [str(f) for f in features if str(f).strip()],
                ensure_ascii=False,
            )

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


# ---------------------------------------------------------------------------
# Estorno via Pagar.me
# ---------------------------------------------------------------------------

def _serialize_credit_purchase(cp: CreditPurchase) -> dict:
    return {
        "id": cp.id,
        "code": cp.code,
        "user_email": cp.user.email if cp.user else None,
        "user_name": cp.user.full_name if cp.user else None,
        "package_name": cp.package_name,
        "amount_cents": cp.amount_cents,
        "amount_brl": format_brl_from_cents(cp.amount_cents),
        "status": cp.status,
        "pagarme_charge_id": cp.pagarme_charge_id,
        "pagarme_order_id": cp.pagarme_order_id,
        "credited_at": cp.credited_at.isoformat() if cp.credited_at else None,
        "created_at": cp.created_at.isoformat(),
        "source_kind": "credit_purchase",
    }


def _checkout_order_package_name(order: Order) -> str:
    plan = Plan.query.filter_by(code=order.service_id).first()
    if plan:
        return plan.name
    service = ServiceCatalogItem.query.filter_by(code=order.service_id).first()
    if service:
        return service.title
    return order.service_id


def _serialize_checkout_order_as_purchase(order: Order) -> dict:
    """Apresenta uma `Order` do checkout no mesmo shape de `AdminCreditPurchase`
    para que o painel financeiro possa listar compras feitas pelos dois fluxos
    (CreditPurchase e Order/checkout) em uma única lista."""
    # Mapear o status do checkout para o vocabulário usado no painel.
    status_map = {
        "paid": "paid",
        "processing": "processing",
        "pending": "pending",
        "waiting_payment": "pending",
        "failed": "failed",
        "canceled": "failed",
        "refunded": "refunded",
    }
    mapped_status = status_map.get(order.status, order.status)
    return {
        "id": order.id,
        "code": f"checkout-{order.id}",
        "user_email": order.user.email if order.user else None,
        "user_name": order.user.full_name if order.user else None,
        "package_name": _checkout_order_package_name(order),
        "amount_cents": order.amount,
        "amount_brl": format_brl_from_cents(order.amount),
        "status": mapped_status,
        "pagarme_charge_id": order.pagarme_charge_id,
        "pagarme_order_id": order.pagarme_order_id,
        "credited_at": order.released_at.isoformat() if order.released_at else None,
        "created_at": order.created_at.isoformat(),
        "source_kind": "checkout_order",
    }


def list_admin_credit_purchases(actor) -> dict:
    purchases = (
        scoped_query(CreditPurchase, actor)
        .order_by(CreditPurchase.created_at.desc())
        .all()
    )
    # Inclui também as compras realizadas pelo checkout (`Order`), pois esse
    # é o fluxo usado quando o cliente compra planos/avulsos a partir do
    # frontend Checkout.tsx.
    checkout_orders = (
        scoped_query(Order, actor)
        .order_by(Order.created_at.desc())
        .all()
    )

    items = [_serialize_credit_purchase(cp) for cp in purchases]
    items.extend(_serialize_checkout_order_as_purchase(o) for o in checkout_orders)
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return {"purchases": items}


def list_admin_checkout_orders(actor) -> dict:
    """Lista todas as Orders do checkout com detalhes de crédito liberado."""
    from app.services.checkout_service import _checkout_release_tx_exists

    orders = (
        scoped_query(Order, actor)
        .order_by(Order.created_at.desc())
        .all()
    )
    result = []
    for o in orders:
        has_release_tx = _checkout_release_tx_exists(o) if o.status == "paid" else False
        item = _serialize_checkout_order_as_purchase(o)
        item["released_at"] = o.released_at.isoformat() if o.released_at else None
        item["has_release_tx"] = has_release_tx
        item["needs_release"] = (
            o.status == "paid"
            and not has_release_tx
            and not getattr(o, "service_order_id", None)
        )
        result.append(item)
    return {"orders": result}


def release_checkout_order_credits(actor, order_id: object) -> dict:
    """Força a liberação de créditos de uma Order paga que ficou sem crédito.

    Útil quando o webhook do gateway falhou e o crédito não foi liberado
    automaticamente. Idempotente: se o crédito já foi liberado, não duplica.
    """
    from app.services.checkout_service import (
        _checkout_release_tx_exists,
        _release_order,
        serialize_checkout_order,
    )

    parsed_id = _to_int(order_id, field_name="id")
    order = scoped_query(Order, actor).filter(Order.id == parsed_id).first()

    if order is None:
        raise NotFoundError("Checkout order não encontrada.")

    if order.status != "paid":
        raise ValidationError(
            f"Só é possível liberar créditos de orders pagas (status atual: '{order.status}')."
        )

    already_released = _checkout_release_tx_exists(order)
    if already_released:
        return {
            "released": False,
            "already_done": True,
            "order": serialize_checkout_order(order),
            "message": "Créditos já foram liberados anteriormente.",
        }

    _release_order(order)
    log_action(
        action="admin.release_checkout_order_credits",
        entity_type="order",
        entity_id=order.id,
        user=actor,
        metadata={"amount_cents": order.amount, "service_id": order.service_id},
    )
    db.session.commit()

    return {
        "released": True,
        "already_done": False,
        "order": serialize_checkout_order(order),
        "message": "Créditos liberados com sucesso.",
    }


def recover_all_pending_credits(actor) -> dict:
    """Recupera créditos de TODAS as orders pagas sem liberação em todos os usuários.

    Equivale a rodar `recover_paid_checkout_credits` para cada usuário que
    tem orders pagas sem crédito. Operação segura e idempotente — não duplica
    créditos já liberados. Retorna contagem de orders recuperadas por usuário.
    """
    from app.services.checkout_service import _checkout_release_tx_exists, _release_order, _credit_release_for_order

    affected_orders = (
        Order.query
        .filter(Order.status == "paid")
        .filter(Order.service_order_id.is_(None))
        .all()
    )

    recovered_orders = []
    skipped = 0
    for order in affected_orders:
        _kind, units = _credit_release_for_order(order)
        if units <= 0:
            skipped += 1
            continue
        if _checkout_release_tx_exists(order):
            skipped += 1
            continue
        _release_order(order)
        recovered_orders.append(order.id)

    if recovered_orders:
        log_action(
            action="admin.recover_all_pending_credits",
            entity_type="order",
            entity_id=None,
            user=actor,
            metadata={"recovered_count": len(recovered_orders), "order_ids": recovered_orders},
        )
        db.session.commit()

    return {
        "recovered": len(recovered_orders),
        "skipped": skipped,
        "order_ids": recovered_orders,
        "message": f"{len(recovered_orders)} order(s) tiveram créditos liberados.",
    }


def refund_credit_purchase(actor, purchase_id: object) -> dict:
    parsed_id = _to_int(purchase_id, field_name="id")
    purchase = scoped_query(CreditPurchase, actor).filter(CreditPurchase.id == parsed_id).first()

    if purchase is None:
        raise NotFoundError("Compra de crédito não encontrada.")

    if purchase.status == "refunded":
        raise ConflictError("Esta compra já foi estornada.")

    if purchase.status not in {"paid", "processing"}:
        raise ValidationError(
            f"Não é possível estornar uma compra com status '{purchase.status}'. "
            "Apenas compras pagas podem ser estornadas."
        )

    if not purchase.pagarme_charge_id:
        raise ValidationError(
            "Esta compra não possui ID de cobrança da Pagar.me. "
            "Verifique se o pagamento foi processado pelo gateway."
        )

    # Chamar Pagar.me — estorno total
    pagarme_response = PagarmeClient().cancel_charge(purchase.pagarme_charge_id)
    gateway_status = str(pagarme_response.get("status") or "").lower()

    if gateway_status not in {"canceled", "refunded", "voided"}:
        raise ValidationError(
            f"A Pagar.me retornou status inesperado: '{gateway_status}'. "
            "Verifique no painel da Pagar.me se o estorno total foi processado."
        )

    # Atualizar status da compra
    purchase.status = "refunded"

    # Reverter créditos se já foram creditados.
    # allow_negative_balance=True: se o cliente já gastou o crédito, o
    # saldo fica negativo (dívida) — o reembolso veio do gateway externo,
    # não do livro-razão, então não podemos recusar a baixa.
    if purchase.credited_at is not None:
        from app.services import credit_ledger
        from app.services.credit_payment_service import CREDIT_PACKAGES

        purchase_owner = db.session.get(User, purchase.user_id)
        if purchase_owner is not None:
            package = CREDIT_PACKAGES.get(purchase.package_id) or {}
            credit_units = int(package.get("credit_units") or 1)
            credit_kind = str(package.get("credit_kind") or credit_ledger.KIND_COMMON)
            credit_ledger.debit(
                purchase_owner,
                amount=credit_units,
                source=purchase.source,
                description=f"Estorno Pagar.me - {purchase.package_name} (#{purchase.code})",
                idempotency_key=f"purchase-reversal-{purchase.id}",
                company_id=purchase.company_id,
                allow_negative_balance=True,
                kind=credit_kind,
            )

    log_action(
        action="admin.refund_credit_purchase",
        entity_type="credit_purchase",
        entity_id=purchase.id,
        user=actor,
        metadata={
            "code": purchase.code,
            "amount_cents": purchase.amount_cents,
            "pagarme_charge_id": purchase.pagarme_charge_id,
            "gateway_status": gateway_status,
            "credits_reversed": purchase.credited_at is not None,
        },
    )
    db.session.commit()

    return {
        "refunded": True,
        "purchase": _serialize_credit_purchase(purchase),
        "gateway_status": gateway_status,
        "credits_reversed": purchase.credited_at is not None,
        "message": "Estorno processado com sucesso pela Pagar.me.",
    }


def refund_checkout_order(actor, order_id: object) -> dict:
    parsed_id = _to_int(order_id, field_name="id")
    order = scoped_query(Order, actor).filter(Order.id == parsed_id).first()

    if order is None:
        raise NotFoundError("Compra de checkout não encontrada.")

    if order.status == "refunded":
        raise ConflictError("Esta compra já foi estornada.")

    if order.status != "paid":
        raise ValidationError(
            f"Não é possível estornar uma compra com status '{order.status}'. "
            "Apenas compras pagas podem ser estornadas."
        )

    if not order.pagarme_charge_id:
        raise ValidationError(
            "Esta compra não possui ID de cobrança da Pagar.me. "
            "Verifique se o pagamento foi processado pelo gateway."
        )

    pagarme_response = PagarmeClient().cancel_charge(order.pagarme_charge_id)
    gateway_status = str(pagarme_response.get("status") or "").lower()

    if gateway_status not in {"canceled", "refunded", "voided"}:
        raise ValidationError(
            f"A Pagar.me retornou status inesperado: '{gateway_status}'. "
            "Verifique no painel da Pagar.me se o estorno total foi processado."
        )

    from app.services.checkout_service import (
        _checkout_release_tx_exists,
        _reverse_released_order,
    )

    had_released_credit = order.released_at is not None
    had_release_tx = _checkout_release_tx_exists(order)
    _reverse_released_order(order, reason="admin_refund")
    credits_reversed = had_released_credit and had_release_tx and order.released_at is None
    order.status = "refunded"

    log_action(
        action="admin.refund_checkout_order",
        entity_type="order",
        entity_id=order.id,
        user=actor,
        metadata={
            "amount_cents": order.amount,
            "pagarme_charge_id": order.pagarme_charge_id,
            "gateway_status": gateway_status,
            "credits_reversed": credits_reversed,
        },
    )
    db.session.commit()

    return {
        "refunded": True,
        "purchase": _serialize_checkout_order_as_purchase(order),
        "gateway_status": gateway_status,
        "credits_reversed": credits_reversed,
        "message": "Estorno processado com sucesso pela Pagar.me.",
    }
