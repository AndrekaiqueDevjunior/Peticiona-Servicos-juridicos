from __future__ import annotations

from app.core.security import format_file_size

STATUS_LABELS = {
    "pendente": "Pendente",
    "em_andamento": "Em andamento",
    "concluido": "Concluído",
}


def format_brl_from_cents(value: int) -> str:
    reais = value / 100
    formatted = f"{reais:,.2f}"
    return f"R$ {formatted}".replace(",", "X").replace(".", ",").replace("X", ".")


def serialize_user(user) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "oab_number": user.oab_number,
        "cpf": user.cpf,
        "phone": user.phone,
        "role": user.role,
        "company_id": user.company_id,
        "is_active": user.is_active,
    }


def serialize_document(document) -> dict:
    return {
        "id": document.id,
        "file_name": document.file_name,
        "size_label": format_file_size(document.size_bytes),
        "created_at": document.created_at.isoformat(),
    }


def serialize_petition(petition) -> dict:
    return {
        "id": petition.id,
        "reference": petition.reference,
        "area_direito": petition.area_direito,
        "tipo_peticao": petition.tipo_peticao,
        "numero_processo": petition.numero_processo,
        "status": petition.status,
        "status_label": STATUS_LABELS.get(petition.status, petition.status.title()),
        "created_at": petition.created_at.isoformat(),
    }


def serialize_order(order) -> dict:
    item_titles = [item.title for item in order.items if item.title]
    return {
        "id": order.id,
        "reference": order.reference,
        "status": order.status,
        "status_label": STATUS_LABELS.get(order.status, order.status.title()),
        "total_amount": order.total_amount,
        "total_brl": format_brl_from_cents(order.total_amount),
        "client_name": order.user.full_name if getattr(order, "user", None) else None,
        "user_id": order.user_id,
        "staff_name": order.staff_user.full_name if getattr(order, "staff_user", None) else None,
        "staff_user_id": order.staff_user_id,
        "service_type": " · ".join(item_titles) if item_titles else "Serviço não informado",
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "deadline_at": order.deadline_at.isoformat() if getattr(order, "deadline_at", None) else None,
        "completed_at": order.completed_at.isoformat() if getattr(order, "completed_at", None) else None,
        "items": [
            {
                "code": item.code,
                "title": item.title,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "line_total": item.line_total,
            }
            for item in order.items
        ],
    }


def serialize_plan(plan) -> dict:
    return {
        "code": plan.code,
        "name": plan.name,
        "description": plan.description,
        "monthly_price_cents": plan.monthly_price_cents,
        "monthly_price_brl": format_brl_from_cents(plan.monthly_price_cents),
        "petition_limit_monthly": plan.petition_limit_monthly,
        "monthly_credits_cents": plan.monthly_credits_cents,
    }
