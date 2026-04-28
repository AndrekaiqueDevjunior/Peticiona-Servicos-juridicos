from __future__ import annotations

from app.core.extensions import db
from app.models import Company, Plan, ServiceCatalogItem


def seed_reference_data() -> None:
    if not Company.query.filter_by(slug="public").first():
        db.session.add(Company(name="Public", slug="public"))

    if not Plan.query.filter_by(code="starter").first():
        db.session.add(
            Plan(
                code="starter",
                name="Starter",
                description="Plano inicial para validar o fluxo do produto.",
                monthly_price_cents=0,
                petition_limit_monthly=10,
                monthly_credits_cents=0,
                is_active=True,
            )
        )

    if not Plan.query.filter_by(code="pro").first():
        db.session.add(
            Plan(
                code="pro",
                name="Pro",
                description="Plano para operação contínua com maior volume.",
                monthly_price_cents=29900,
                petition_limit_monthly=None,
                monthly_credits_cents=0,
                is_active=True,
            )
        )

    from app.services.client_area_service import CATALOG

    for section in CATALOG:
        for item in section["items"]:
            service = ServiceCatalogItem.query.filter_by(code=item["code"]).first()
            if service is None:
                db.session.add(
                    ServiceCatalogItem(
                        code=item["code"],
                        section=section["section"],
                        title=item["title"],
                        description=item.get("description"),
                        unit_price=item["unit_price"],
                        is_active=True,
                    )
                )
                continue

            service.section = section["section"]
            service.title = item["title"]
            service.description = item.get("description")
            service.unit_price = item["unit_price"]
            service.is_active = True

    db.session.commit()
