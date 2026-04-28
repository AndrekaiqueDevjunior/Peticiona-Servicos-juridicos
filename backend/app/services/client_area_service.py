from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from app.core.errors import NotFoundError, ValidationError
from app.core.extensions import db
from app.core.security import ensure_allowed_document, ensure_upload_size, upload_folder
from app.models import Company, Document, ServiceCatalogItem, ServiceOrder, ServiceOrderItem
from app.services.audit_service import log_action
from app.services.serializers import format_brl_from_cents, serialize_document, serialize_order

CATALOG = [
    {
        "section": "Petições",
        "items": [
            {
                "code": "peticao-inicial",
                "title": "Petição inicial",
                "description": "Estruturação da peça inicial com base nos documentos enviados.",
                "unit_price": 18900,
            },
            {
                "code": "contestacao",
                "title": "Contestação",
                "description": "Defesa estruturada com análise do processo e documentos.",
                "unit_price": 15900,
            },
        ],
    },
    {
        "section": "Recursos",
        "items": [
            {
                "code": "recurso-apelacao",
                "title": "Recurso de apelação",
                "description": "Preparação de recurso com foco em revisão de sentença.",
                "unit_price": 24900,
            }
        ],
    },
]


def _catalog_index() -> dict[str, dict]:
    return {item["code"]: item for section in _catalog_sections() for item in section["items"]}


def _catalog_sections() -> list[dict]:
    services = (
        ServiceCatalogItem.query.filter_by(is_active=True)
        .order_by(ServiceCatalogItem.id.asc())
        .all()
    )
    if not services:
        return CATALOG

    sections: dict[str, dict] = {}
    for service in services:
        section = sections.setdefault(service.section, {"section": service.section, "items": []})
        section["items"].append(
            {
                "code": service.code,
                "title": service.title,
                "description": service.description,
                "unit_price": service.unit_price,
            }
        )
    return list(sections.values())


def _public_company() -> Company:
    company = Company.query.filter_by(slug="public").first()
    if company is None:
        raise NotFoundError("Empresa pública de fallback não encontrada.")
    return company


def _next_reference() -> str:
    return f"ORD-{ServiceOrder.query.count() + 1:06d}"


def get_catalog() -> dict:
    return {"catalog": _catalog_sections()}


def preview_cart(payload: dict) -> dict:
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        raise ValidationError("Carrinho vazio.")

    catalog = _catalog_index()
    normalized_items = []
    total = 0

    for raw in items:
        code = (raw.get("code") or "").strip()
        quantity = int(raw.get("quantity") or 0)
        if quantity <= 0:
            raise ValidationError("Quantidade deve ser maior que zero.")
        if code not in catalog:
            raise NotFoundError(f"Serviço '{code}' não encontrado.")

        product = catalog[code]
        line_total = product["unit_price"] * quantity
        total += line_total
        normalized_items.append(
            {
                "code": code,
                "title": product["title"],
                "quantity": quantity,
                "unit_price": product["unit_price"],
                "line_total": line_total,
            }
        )

    return {
        "is_valid": True,
        "items": normalized_items,
        "total_amount": total,
        "total_brl": format_brl_from_cents(total),
    }


def create_order(payload: dict, *, user=None) -> tuple[dict, int]:
    preview = preview_cart(payload)
    company_id = getattr(user, "company_id", None) or _public_company().id

    order = ServiceOrder(
        user_id=getattr(user, "id", None),
        company_id=company_id,
        reference=_next_reference(),
        status="pendente",
        total_amount=preview["total_amount"],
    )
    db.session.add(order)
    db.session.flush()

    for item in preview["items"]:
        db.session.add(
            ServiceOrderItem(
                order_id=order.id,
                company_id=company_id,
                code=item["code"],
                title=item["title"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                line_total=item["line_total"],
            )
        )

    log_action(
        action="order.created",
        entity_type="service_order",
        entity_id=order.id,
        user=user,
        company_id=company_id,
        metadata={"reference": order.reference, "total_amount": order.total_amount},
    )
    db.session.commit()
    return {"message": "Pedido criado com sucesso.", "order": serialize_order(order)}, 201


def upload_documents(user, files) -> tuple[dict, int]:
    if not files:
        raise ValidationError("Envie ao menos um documento.")

    folder = upload_folder()
    created_documents = []

    for file_storage in files:
        filename = ensure_allowed_document(file_storage.filename or "")
        content = file_storage.read()
        ensure_upload_size(len(content))

        suffix = Path(filename).suffix.lower()
        stored_name = f"{uuid4().hex}{suffix}"
        (folder / stored_name).write_bytes(content)

        document = Document(
            user_id=user.id,
            company_id=user.company_id,
            file_name=filename,
            stored_name=stored_name,
            mime_type=file_storage.mimetype,
            size_bytes=len(content),
        )
        db.session.add(document)
        created_documents.append(document)

    db.session.flush()
    log_action(
        action="document.uploaded",
        entity_type="document_batch",
        entity_id=created_documents[0].id,
        user=user,
        metadata={"count": len(created_documents)},
    )
    db.session.commit()
    return {
        "message": "Upload concluído com segurança.",
        "documents": [serialize_document(item) for item in created_documents],
    }, 201
