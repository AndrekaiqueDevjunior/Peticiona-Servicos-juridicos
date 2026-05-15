from __future__ import annotations

from app.core.security import format_file_size

STATUS_LABELS = {
    "pendente": "Em análise",
    "em_andamento": "Aguardando dados",
    "concluido": "Concluído",
    "cancelado": "Cancelado",
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
        "role_title": user.role_title,
        "employee_code": user.employee_code,
        "zip_code": user.zip_code,
        "street": user.street,
        "street_number": user.street_number,
        "address_complement": user.address_complement,
        "neighborhood": user.neighborhood,
        "city": user.city,
        "state": user.state,
        "role": user.role,
        "company_id": user.company_id,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
        "created_at_label": user.created_at.strftime("%d/%m/%Y"),
    }


def serialize_document(document) -> dict:
    return {
        "id": document.id,
        "file_name": document.file_name,
        "size_label": format_file_size(document.size_bytes),
        "created_at": document.created_at.isoformat(),
        "download_url": f"/api/documents/{document.id}/download",
    }


def serialize_petition(petition) -> dict:
    return {
        "id": petition.id,
        "reference": petition.reference,
        "area_direito": petition.area_direito,
        "tipo_peticao": petition.tipo_peticao,
        "numero_processo": petition.numero_processo,
        "data_publicacao": petition.data_publicacao,
        "justica_gratuita": petition.justica_gratuita,
        "tutela_urgencia": petition.tutela_urgencia,
        "advogado_subscritor": petition.advogado_subscritor,
        "resumo_caso": petition.resumo_caso,
        "detalhes": petition.detalhes,
        "status": petition.status,
        "status_label": STATUS_LABELS.get(petition.status, petition.status.title()),
        "created_at": petition.created_at.isoformat(),
        "partes": [
            {"nome": party.nome, "tipo": party.tipo}
            for party in (getattr(petition, "parties", None) or [])
        ],
        "documents": [
            serialize_document(link.document)
            for link in (getattr(petition, "document_links", None) or [])
            if getattr(link, "document", None) is not None
        ],
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
        "petition_id": getattr(order, "petition_id", None),
        "petition": serialize_petition(order.petition) if getattr(order, "petition", None) else None,
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
    import json as _json
    features = []
    if getattr(plan, "features_json", None):
        try:
            features = _json.loads(plan.features_json)
        except Exception:
            features = []
    unit_price_cents = getattr(plan, "price_per_service_cents", None)
    return {
        "code": plan.code,
        "name": plan.name,
        "description": plan.description,
        "subtitle": getattr(plan, "subtitle", None),
        "monthly_price_cents": plan.monthly_price_cents,
        "monthly_price_brl": format_brl_from_cents(plan.monthly_price_cents),
        "price_cents": plan.monthly_price_cents,
        "price_formatted": format_brl_from_cents(plan.monthly_price_cents),
        "petition_limit_monthly": plan.petition_limit_monthly,
        "monthly_credits_cents": plan.monthly_credits_cents,
        "price_per_service_cents": unit_price_cents,
        "unit_price_cents": unit_price_cents,
        "unit_price_formatted": format_brl_from_cents(unit_price_cents) if unit_price_cents is not None else None,
        "credits_quantity": getattr(plan, "credits_quantity", None),
        "validity_days": getattr(plan, "validity_days", None),
        "delivery_label": getattr(plan, "delivery_label", None),
        "badge": getattr(plan, "badge", None),
        "sort_order": getattr(plan, "sort_order", 0) or 0,
        "benefits": features,
        "features": features,
        "is_highlighted": bool(getattr(plan, "is_highlighted", False)),
        "is_active": bool(getattr(plan, "is_active", True)),
        "cta_label": getattr(plan, "cta_label", None),
    }


def serialize_service_catalog_item(service) -> dict:
    return {
        "code": service.code,
        "section": service.section,
        "name": service.title,
        "title": service.title,
        "description": service.description,
        "price_cents": service.unit_price,
        "price_formatted": format_brl_from_cents(service.unit_price),
        "unit_price": service.unit_price,
        "unit_price_brl": format_brl_from_cents(service.unit_price),
        "delivery_label": getattr(service, "delivery_label", None),
        "is_active": bool(getattr(service, "is_active", True)),
    }
