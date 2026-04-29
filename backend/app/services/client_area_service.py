from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from datetime import datetime, timezone

from app.core.errors import NotFoundError, ValidationError
from app.core.extensions import db
from app.core.security import ensure_allowed_document, ensure_upload_size, upload_folder
from app.domain.permissions import scoped_query
from app.models import Company, Document, Petition, PetitionDocumentLink, ServiceCatalogItem, ServiceOrder, ServiceOrderItem
from app.services.audit_service import log_action
from app.services.serializers import format_brl_from_cents, serialize_document, serialize_order

CATALOG = [
    {
        "section": "Petições",
        "items": [
            {
                "code": "solicitacao-juridica",
                "title": "Solicitação jurídica",
                "description": "Solicitação padrão de petição (preço base).",
                "unit_price": 16000,
            },
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


def _parse_datetime(value: object, *, field_name: str) -> datetime | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"Campo '{field_name}' precisa estar em formato ISO-8601.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _scoped_client_order(user, order_id: object) -> ServiceOrder:
    try:
        parsed_id = int(order_id)
    except (TypeError, ValueError) as exc:
        raise ValidationError("Pedido inválido.") from exc
    order = (
        scoped_query(ServiceOrder, user)
        .filter(ServiceOrder.id == parsed_id, ServiceOrder.user_id == user.id)
        .first()
    )
    if order is None:
        raise NotFoundError("Pedido não encontrado.")
    return order


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
        try:
            quantity = int(raw.get("quantity") or 0)
        except (TypeError, ValueError) as exc:
            raise ValidationError("Quantidade inválida.") from exc
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


def _preview_service_request(payload: dict) -> dict:
    title = (payload.get("tipo_peticao") or payload.get("area_direito") or payload.get("service_title") or "").strip()
    if not title:
        raise ValidationError("Informe o tipo de serviço solicitado.")

    # Preço vem do catálogo; client-supplied total_amount_cents é ignorado.
    service_code = (payload.get("service_code") or "solicitacao-juridica").strip()
    catalog = _catalog_index()
    catalog_item = catalog.get(service_code)
    total_amount = catalog_item["unit_price"] if catalog_item else 0

    item = {
        "code": service_code,
        "title": title,
        "quantity": 1,
        "unit_price": total_amount,
        "line_total": total_amount,
    }
    return {
        "is_valid": True,
        "items": [item],
        "total_amount": total_amount,
        "total_brl": format_brl_from_cents(total_amount),
    }


def preview_service_request(payload: dict) -> dict:
    return _preview_service_request(payload)


def list_orders(user) -> dict:
    orders = scoped_query(ServiceOrder, user).order_by(ServiceOrder.created_at.desc()).all()
    return {"orders": [serialize_order(order) for order in orders]}


def get_order(user, order_id: object) -> dict:
    return {"order": serialize_order(_scoped_client_order(user, order_id))}


def update_order(user, order_id: object, payload: dict) -> dict:
    order = _scoped_client_order(user, order_id)
    if order.status != "pendente":
        raise ValidationError("Apenas pedidos pendentes podem ser editados pelo cliente.")

    if "deadline_at" in payload:
        order.deadline_at = _parse_datetime(payload.get("deadline_at"), field_name="deadline_at")

    petition = order.petition
    if petition is not None:
        for field in (
            "area_direito",
            "tipo_peticao",
            "numero_processo",
            "data_publicacao",
            "advogado_subscritor",
            "resumo_caso",
            "detalhes",
        ):
            if field in payload:
                value = str(payload.get(field) or "").strip()
                if field == "area_direito" and not value:
                    raise ValidationError("Área do Direito é obrigatória.")
                setattr(petition, field, value or None)
        if "justica_gratuita" in payload:
            petition.justica_gratuita = bool(payload.get("justica_gratuita"))
        if "tutela_urgencia" in payload:
            petition.tutela_urgencia = bool(payload.get("tutela_urgencia"))

    log_action(
        action="order.updated_by_client",
        entity_type="service_order",
        entity_id=order.id,
        user=user,
        metadata={"reference": order.reference},
    )
    db.session.commit()
    return {"order": serialize_order(order)}


def cancel_order(user, order_id: object) -> dict:
    order = _scoped_client_order(user, order_id)
    if order.status == "concluido":
        raise ValidationError("Pedidos concluídos não podem ser cancelados pelo cliente.")
    if order.status != "cancelado":
        order.status = "cancelado"
        log_action(
            action="order.cancelled_by_client",
            entity_type="service_order",
            entity_id=order.id,
            user=user,
            metadata={"reference": order.reference},
        )
        db.session.commit()
    return {"deleted": True, "order": serialize_order(order)}


def create_order(payload: dict, *, user=None) -> tuple[dict, int]:
    if payload.get("items"):
        preview = preview_cart(payload)
    else:
        preview = _preview_service_request(payload)
    company_id = getattr(user, "company_id", None) or _public_company().id
    petition_id = None
    if payload.get("petition_id") is not None and user is not None:
        try:
            parsed_petition_id = int(payload.get("petition_id"))
        except (TypeError, ValueError) as exc:
            raise ValidationError("Campo 'petition_id' inválido.") from exc
        petition = (
            scoped_query(Petition, user)
            .filter(Petition.id == parsed_petition_id, Petition.user_id == user.id)
            .first()
        )
        if petition is None:
            raise NotFoundError("Petição vinculada ao pedido não encontrada.")
        petition_id = petition.id

    order = ServiceOrder(
        user_id=getattr(user, "id", None),
        petition_id=petition_id,
        company_id=company_id,
        reference=_next_reference(),
        status="pendente",
        total_amount=preview["total_amount"],
    )
    deadline_at = payload.get("deadline_at")
    if deadline_at:
        order.deadline_at = _parse_datetime(deadline_at, field_name="deadline_at")

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


def delete_document(user, document_id: object) -> dict:
    try:
        parsed_id = int(document_id)
    except (TypeError, ValueError) as exc:
        raise ValidationError("Documento inválido.") from exc

    document = (
        scoped_query(Document, user)
        .filter(Document.id == parsed_id, Document.user_id == user.id)
        .first()
    )
    if document is None:
        raise NotFoundError("Documento não encontrado.")

    linked = PetitionDocumentLink.query.filter_by(document_id=document.id).first()
    if linked is not None:
        raise ValidationError("Documento vinculado a uma petição não pode ser removido.")

    stored_name = document.stored_name
    db.session.delete(document)
    log_action(
        action="document.deleted",
        entity_type="document",
        entity_id=parsed_id,
        user=user,
        metadata={"file_name": document.file_name},
    )
    db.session.commit()

    try:
        (upload_folder() / stored_name).unlink(missing_ok=True)
    except OSError:
        pass
    return {"deleted": True}
