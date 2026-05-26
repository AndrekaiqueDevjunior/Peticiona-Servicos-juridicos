from __future__ import annotations

import json

from app.core.extensions import db
from app.models import Company, Plan, ServiceCatalogItem


BASE_BENEFITS = [
    "Sem mensalidade",
    "Sem taxa de ativação",
    "1 ano para usar seus créditos",
    "Entrega em até 3 dias úteis",
    "1 ano para utilização do pacote",
    "Sem limite de utilizações mensais",
    "Sem cobrança adicional por complexidade",
    "Atendimento humanizado",
]

CANONICAL_PLANS: list[dict] = [
    {
        "code": "plano_essencial",
        "name": "Plano Essencial",
        "subtitle": "Para começar com previsibilidade",
        "monthly_price_cents": 48000,
        "price_per_service_cents": 16000,
        "credits_quantity": 3,
        "validity_days": 365,
        "delivery_label": "Entrega em até 3 dias úteis",
        "badge": None,
        "sort_order": 10,
        "is_highlighted": False,
        "benefits": list(BASE_BENEFITS),
    },
    {
        "code": "plano_profissional",
        "name": "Plano Intermediário",
        "subtitle": "Para escritórios em crescimento",
        "monthly_price_cents": 75000,
        "price_per_service_cents": 15000,
        "credits_quantity": 5,
        "validity_days": 365,
        "delivery_label": "Entrega em até 3 dias úteis",
        "badge": "Mais escolhido",
        "sort_order": 20,
        "is_highlighted": True,
        "benefits": BASE_BENEFITS + ["Preço reduzido nos demais serviços da plataforma"],
    },
    {
        "code": "plano_estrategico",
        "name": "Plano Premium",
        "subtitle": "Para alta demanda e escala",
        "monthly_price_cents": 280000,
        "price_per_service_cents": 14000,
        "credits_quantity": 20,
        "validity_days": 365,
        "delivery_label": "Entrega em até 2 dias úteis",
        "badge": None,
        "sort_order": 30,
        "is_highlighted": False,
        "benefits": [
            "Sem mensalidade",
            "Sem taxa de ativação",
            "1 ano para usar seus créditos",
            "Entrega em até 2 dias úteis",
            "1 ano para utilização do pacote",
            "Sem limite de utilizações mensais",
            "Sem cobrança adicional por complexidade",
            "Atendimento humanizado",
            "Preço ainda mais reduzido nos demais serviços da plataforma",
        ],
    },
]


CANONICAL_SERVICES: list[dict] = [
    {
        "code": "servico_peticao",
        "section": "Petições",
        "title": "Petição",
        "description": "Petição jurídica padrão (entrega regular).",
        "unit_price": 18000,
        "delivery_label": "Entrega em até 3 dias úteis",
    },
    {
        "code": "servico_recurso",
        "section": "Recursos",
        "title": "Recurso",
        "description": "Recurso jurídico padrão (entrega regular).",
        "unit_price": 20000,
        "delivery_label": "Entrega em até 3 dias úteis",
    },
    {
        "code": "servico_peticao_express",
        "section": "Petições",
        "title": "Petição Express",
        "description": "Petição jurídica entregue em 24 horas.",
        "unit_price": 22000,
        "delivery_label": "Entrega em 24h",
    },
    {
        "code": "servico_recurso_express",
        "section": "Recursos",
        "title": "Recurso Express",
        "description": "Recurso jurídico entregue em 24 horas.",
        "unit_price": 25000,
        "delivery_label": "Entrega em 24h",
    },
]


LEGACY_PLAN_CODES = {"starter", "pro"}
CANONICAL_SERVICE_CODES = {entry["code"] for entry in CANONICAL_SERVICES}


def _upsert_plan(payload: dict) -> None:
    plan = Plan.query.filter_by(code=payload["code"]).first()
    fields = {
        "name": payload["name"],
        "subtitle": payload.get("subtitle"),
        "description": payload.get("subtitle"),
        "monthly_price_cents": payload["monthly_price_cents"],
        "price_per_service_cents": payload.get("price_per_service_cents"),
        "credits_quantity": payload.get("credits_quantity"),
        "validity_days": payload.get("validity_days"),
        "delivery_label": payload.get("delivery_label"),
        "badge": payload.get("badge"),
        "sort_order": payload.get("sort_order") or 0,
        "is_highlighted": bool(payload.get("is_highlighted")),
        "is_active": True,
        "petition_limit_monthly": payload.get("credits_quantity"),
        # Crédito que entra na carteira do cliente após o pagamento do plano.
        # Mantemos paridade com o valor pago (1:1) para que o saldo total bata
        # com o que ele desembolsou e permita uso de acordo com o preço por
        # serviço.
        "monthly_credits_cents": payload["monthly_price_cents"],
        "features_json": json.dumps(payload.get("benefits") or [], ensure_ascii=False),
        "cta_label": f"Adquirir {payload['name'].replace('Plano ', '')}",
    }
    if plan is None:
        db.session.add(Plan(code=payload["code"], **fields))
        return
    for key, value in fields.items():
        setattr(plan, key, value)


def _upsert_service(payload: dict) -> None:
    service = ServiceCatalogItem.query.filter_by(code=payload["code"]).first()
    fields = {
        "section": payload["section"],
        "title": payload["title"],
        "description": payload.get("description"),
        "unit_price": payload["unit_price"],
        "delivery_label": payload.get("delivery_label"),
        "is_active": True,
    }
    if service is None:
        db.session.add(ServiceCatalogItem(code=payload["code"], **fields))
        return
    for key, value in fields.items():
        setattr(service, key, value)


def _deactivate_legacy_plans() -> None:
    legacy = Plan.query.filter(Plan.code.in_(LEGACY_PLAN_CODES)).all()
    for plan in legacy:
        plan.is_active = False


def seed_reference_data() -> None:
    if not Company.query.filter_by(slug="public").first():
        db.session.add(Company(name="Public", slug="public"))

    for entry in CANONICAL_PLANS:
        _upsert_plan(entry)

    _deactivate_legacy_plans()

    for entry in CANONICAL_SERVICES:
        _upsert_service(entry)

    db.session.commit()
