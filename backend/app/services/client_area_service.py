from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from datetime import datetime, timezone

from app.core.errors import NotFoundError, ValidationError
from app.core.extensions import db
from app.core.security import ensure_allowed_document, ensure_upload_size, upload_folder
from app.domain.permissions import scoped_query
from app.models import (
    Company,
    CreditTransaction,
    Document,
    Petition,
    PetitionDocumentLink,
    PetitionParty,
    ServiceCatalogItem,
    ServiceOrder,
    ServiceOrderItem,
)
from app.services.audit_service import log_action
from app.services.serializers import format_brl_from_cents, serialize_document, serialize_order

# CATALOG legado (desativado).
#
# Este array historicamente alimentava dois caminhos:
#  1. fallback do _catalog_sections() quando o DB estava vazio.
#  2. seed automático em app.bootstrap.seed.seed_reference_data() — que
#     percorria CATALOG e, para cada item, FAZIA UPDATE com is_active=True
#     sempre que o registro existia. Isso reativava os serviços legados a
#     cada restart do backend.
#
# Os serviços avulsos oficiais (Petição, Recurso, Petição Express, Recurso
# Express) vivem agora no banco via migrations 2026-05-10-fixes.sql e
# 2026-05-10-seed-canonical.sql. Manter CATALOG vazio impede que o seed
# sobrescreva o estado canônico.
CATALOG: list[dict] = []


def _catalog_index() -> dict[str, dict]:
    return {
        item["code"]: {**item, "section": section["section"]}
        for section in _catalog_sections()
        for item in section["items"]
    }


def _normalize_text(value: object) -> str:
    import unicodedata

    text = str(value or "")
    return "".join(
        ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn"
    ).lower()


def _infer_service_group(payload: dict) -> str | None:
    explicit = str(payload.get("grupo_servico") or payload.get("service_group") or "").strip().upper()
    if explicit in {"A", "B"}:
        return explicit

    title = str(payload.get("tipo_peticao") or payload.get("service_title") or "").strip()
    grupo_b = {
        "Petição inicial comum",
        "Mandado de segurança",
        "Cumprimento de sentença (inicial)",
        "Apelação",
        "Agravo de instrumento",
        "Agravo interno",
        "Embargos de declaração",
        "Recurso ordinário",
        "Recurso especial",
        "Recurso extraordinário",
        "Agravo em recurso especial",
        "Agravo em recurso extraordinário",
    }
    if title in grupo_b:
        return "B"
    return "A" if title else None


def _service_matches(item: dict, *, grupo: str | None, modalidade: str) -> bool:
    haystack = _normalize_text(f"{item.get('code')} {item.get('title')} {item.get('section')}")
    wants_express = modalidade == "express"
    is_express = "express" in haystack
    if wants_express != is_express:
        return False

    is_recurso = "recurso" in haystack or "recursos" in haystack
    is_peticao = "peticao" in haystack or "peticoes" in haystack or "contestacao" in haystack

    if grupo == "B":
        return is_recurso or "inicial" in haystack
    if grupo == "A":
        return is_peticao and not is_recurso
    return True


def _resolve_service_item(payload: dict) -> dict:
    catalog = _catalog_index()
    service_code = str(payload.get("service_code") or "").strip()
    if service_code:
        catalog_item = catalog.get(service_code)
        if not catalog_item:
            raise NotFoundError(f"Serviço '{service_code}' não encontrado.")
        return catalog_item

    items = list(catalog.values())
    modalidade = str(payload.get("modalidade") or payload.get("delivery_mode") or "padrao").strip().lower()
    grupo = _infer_service_group(payload)
    inferred = next(
        (item for item in items if _service_matches(item, grupo=grupo, modalidade=modalidade)),
        None,
    )
    if inferred:
        return inferred

    default = catalog.get("solicitacao-juridica")
    if default:
        return default

    non_express = next(
        (item for item in items if "express" not in _normalize_text(f"{item.get('code')} {item.get('title')}")),
        None,
    )
    if non_express:
        return non_express

    raise NotFoundError("Nenhum serviço ativo encontrado no catálogo.")


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
                "delivery_label": getattr(service, "delivery_label", None),
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

    # Preço vem sempre do catálogo oficial; valores enviados pelo cliente são ignorados.
    catalog_item = _resolve_service_item(payload)
    service_code = catalog_item["code"]
    total_amount = catalog_item["unit_price"]

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
                # Mantém string vazia se for o caso, não converte para None
                setattr(petition, field, value if value != "" else "")
        if "justica_gratuita" in payload:
            petition.justica_gratuita = bool(payload.get("justica_gratuita"))
        if "tutela_urgencia" in payload:
            petition.tutela_urgencia = bool(payload.get("tutela_urgencia"))

        # Partes do processo — estratégia replace: o cliente envia o novo
        # array completo e substituímos. Cada parte é validada (nome + tipo).
        if "partes" in payload:
            raw_partes = payload.get("partes")
            if not isinstance(raw_partes, list):
                raise ValidationError("Campo 'partes' deve ser uma lista.")
            novas_partes: list[PetitionParty] = []
            for idx, raw in enumerate(raw_partes, start=1):
                if not isinstance(raw, dict):
                    raise ValidationError(f"Parte #{idx} inválida.")
                nome = str(raw.get("nome") or "").strip()
                tipo = str(raw.get("tipo") or "").strip()
                if not nome:
                    raise ValidationError(f"Parte #{idx} sem nome.")
                if not tipo:
                    raise ValidationError(f"Parte #{idx} sem tipo (autor/réu/etc).")
                novas_partes.append(
                    PetitionParty(
                        nome=nome[:160],
                        tipo=tipo[:60],
                        company_id=petition.company_id,
                    )
                )
            # cascade="all, delete-orphan" no relacionamento parties cuida do
            # delete: reatribuir a lista remove os antigos e insere os novos
            # na mesma transação.
            petition.parties = novas_partes

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
        # Estornar créditos se houver débito associado ao pedido
        if order.total_amount > 0:
            debit = (
                CreditTransaction.query
                .filter(
                    CreditTransaction.user_id == user.id,
                    CreditTransaction.source == "client_order",
                    CreditTransaction.type == "out",
                    CreditTransaction.description.like(f"%{order.reference}%"),
                )
                .first()
            )
            already_refunded = (
                CreditTransaction.query
                .filter(
                    CreditTransaction.user_id == user.id,
                    CreditTransaction.source == "client_order_refund",
                    CreditTransaction.description.like(f"%{order.reference}%"),
                )
                .first()
            )
            if debit and not already_refunded:
                db.session.add(
                    CreditTransaction(
                        user_id=user.id,
                        company_id=getattr(user, "company_id", None),
                        type="in",
                        source="client_order_refund",
                        amount=order.total_amount,
                        description=f"Estorno — {order.reference}",
                    )
                )
        log_action(
            action="order.cancelled_by_client",
            entity_type="service_order",
            entity_id=order.id,
            user=user,
            metadata={"reference": order.reference},
        )
        db.session.commit()
    return {"deleted": True, "order": serialize_order(order)}


def _assert_sufficient_balance(user, amount: int) -> None:
    rows = (
        db.session.query(CreditTransaction)
        .filter(
            CreditTransaction.user_id == user.id,
        )
        .with_for_update()
        .all()
    )
    balance = sum(t.amount if t.type in ("in", "credit") else -t.amount for t in rows)
    if balance < amount:
        raise ValidationError(
            f"Saldo insuficiente. Disponível: {format_brl_from_cents(max(0, balance))}. "
            f"Necessário: {format_brl_from_cents(amount)}."
        )


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

    total_amount = preview["total_amount"]

    if user is not None and total_amount > 0:
        _assert_sufficient_balance(user, total_amount)

    order = ServiceOrder(
        user_id=getattr(user, "id", None),
        petition_id=petition_id,
        company_id=company_id,
        reference=_next_reference(),
        status="pendente",
        total_amount=total_amount,
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

    if user is not None and total_amount > 0:
        service_title = preview["items"][0]["title"] if preview["items"] else "Serviço"
        db.session.add(
            CreditTransaction(
                user_id=user.id,
                company_id=getattr(user, "company_id", None),
                type="out",
                source="client_order",
                amount=total_amount,
                description=f"Débito — {order.reference} ({service_title})",
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


def attach_order_documents(user, order_id: object, files) -> tuple[dict, int]:
    """Faz upload de documentos e vincula à petição do pedido do cliente.

    Reaproveita upload_documents para criar Document records (e gravar os
    bytes), depois cria PetitionDocumentLink ligando cada documento à
    petição associada ao ServiceOrder do próprio cliente.
    """
    if not files:
        raise ValidationError("Envie ao menos um documento.")

    order = _scoped_client_order(user, order_id)
    if order.petition_id is None:
        raise ValidationError("Este pedido não possui petição associada.")

    payload, status = upload_documents(user, files)
    documents = payload.get("documents", [])
    if not documents:
        return payload, status

    document_ids = [doc["id"] for doc in documents]
    for doc_id in document_ids:
        existing = PetitionDocumentLink.query.filter_by(
            petition_id=order.petition_id, document_id=doc_id
        ).first()
        if existing is None:
            db.session.add(
                PetitionDocumentLink(
                    petition_id=order.petition_id,
                    document_id=doc_id,
                    company_id=getattr(user, "company_id", None),
                )
            )
    log_action(
        action="order.documents_attached_by_client",
        entity_type="service_order",
        entity_id=order.id,
        user=user,
        metadata={"order_reference": order.reference, "document_ids": document_ids},
    )
    db.session.commit()

    return {
        "message": "Documentos anexados ao pedido.",
        "documents": documents,
        "order": serialize_order(order),
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
