from __future__ import annotations

from app.core.errors import NotFoundError
from app.models import Plan, ServiceCatalogItem
from app.services.client_area_service import get_catalog as get_public_catalog
from app.services.serializers import serialize_plan, serialize_service_catalog_item

__all__ = [
    "get_home_content",
    "get_plans_catalog",
    "get_public_catalog",
    "get_full_catalog",
    "get_catalog_item",
]


def get_home_content() -> dict:
    return {
        "hero": {
            "title": "Peticiona",
            "subtitle": "Fluxo jurídico com regras de negócio no backend e operação preparada para escalar.",
        },
        "highlights": [
            "Autenticação centralizada",
            "Permissões por papel",
            "Isolamento por empresa",
            "Auditoria dos eventos sensíveis",
        ],
    }


def _ordered_active_plans():
    return (
        Plan.query.filter_by(is_active=True)
        .order_by(Plan.sort_order.asc(), Plan.monthly_price_cents.asc())
        .all()
    )


def _ordered_active_services():
    return (
        ServiceCatalogItem.query.filter_by(is_active=True)
        .order_by(ServiceCatalogItem.section.asc(), ServiceCatalogItem.id.asc())
        .all()
    )


def get_plans_catalog() -> dict:
    plans = _ordered_active_plans()
    return {"plans": [serialize_plan(plan) for plan in plans]}


def get_full_catalog() -> dict:
    plans = _ordered_active_plans()
    services = _ordered_active_services()
    return {
        "plans": [serialize_plan(plan) for plan in plans],
        "services": [serialize_service_catalog_item(service) for service in services],
    }


def get_catalog_item(code: str) -> dict:
    code = (code or "").strip().lower()
    if not code:
        raise NotFoundError("Código do catálogo obrigatório.")
    plan = Plan.query.filter_by(code=code, is_active=True).first()
    if plan is not None:
        return {"type": "plan", "item": serialize_plan(plan)}
    service = ServiceCatalogItem.query.filter_by(code=code, is_active=True).first()
    if service is not None:
        return {"type": "service", "item": serialize_service_catalog_item(service)}
    raise NotFoundError("Item do catálogo não encontrado.")
