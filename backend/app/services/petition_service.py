from __future__ import annotations

from datetime import datetime, timezone

from app.core.errors import PermissionDenied, ValidationError
from app.core.extensions import db
from app.domain.permissions import scoped_query
from app.domain.plan_rules import ensure_plan_allows_new_petition
from app.models import Document, Petition, PetitionDocumentLink, PetitionParty, ServiceOrder, ServiceOrderItem
from app.services.audit_service import log_action
from app.services.serializers import serialize_order, serialize_petition


def _next_reference() -> str:
    return f"PET-{Petition.query.count() + 1:06d}"


def _validate_document_ids(user, document_ids: list[int]) -> list[Document]:
    if not document_ids:
        return []

    documents = scoped_query(Document, user).filter(Document.id.in_(document_ids)).all()
    if len(documents) != len(set(document_ids)):
        raise PermissionDenied("Um ou mais documentos não pertencem à sua conta.")
    return documents


def create_petition(user, payload: dict) -> dict:
    area_direito = (payload.get("area_direito") or "").strip()
    if not area_direito:
        raise ValidationError("Área do Direito é obrigatória.")

    parties = payload.get("partes") or []
    if not isinstance(parties, list) or not parties:
        raise ValidationError("Informe ao menos uma parte.")

    ensure_plan_allows_new_petition(user)
    documents = _validate_document_ids(user, [int(item) for item in payload.get("document_ids", [])])

    petition = Petition(
        user_id=user.id,
        company_id=user.company_id,
        reference=_next_reference(),
        area_direito=area_direito,
        tipo_peticao=(payload.get("tipo_peticao") or "").strip() or None,
        numero_processo=(payload.get("numero_processo") or "").strip() or None,
        data_publicacao=(payload.get("data_publicacao") or "").strip() or None,
        justica_gratuita=bool(payload.get("justica_gratuita")),
        tutela_urgencia=bool(payload.get("tutela_urgencia")),
        advogado_subscritor=(payload.get("advogado_subscritor") or "").strip() or None,
        resumo_caso=(payload.get("resumo_caso") or "").strip() or None,
        detalhes=(payload.get("detalhes") or "").strip() or None,
        status="pendente",
    )
    db.session.add(petition)
    db.session.flush()

    for party in parties:
        nome = (party.get("nome") or "").strip()
        tipo = (party.get("tipo") or "").strip()
        if not nome or not tipo:
            raise ValidationError("Todas as partes devem ter nome e tipo.")
        db.session.add(
            PetitionParty(
                petition_id=petition.id,
                company_id=user.company_id,
                nome=nome,
                tipo=tipo,
            )
        )

    for document in documents:
        db.session.add(
            PetitionDocumentLink(
                petition_id=petition.id,
                document_id=document.id,
                company_id=user.company_id,
            )
        )

    order = _create_service_order_for_petition(user, petition, payload)

    log_action(
        action="petition.created",
        entity_type="petition",
        entity_id=petition.id,
        user=user,
        metadata={"reference": petition.reference, "status": petition.status},
    )
    db.session.commit()
    return {
        "message": "Petição criada com sucesso.",
        "petition": serialize_petition(petition),
        "order": serialize_order(order),
    }


def list_petitions(user) -> dict:
    petitions = scoped_query(Petition, user).order_by(Petition.created_at.desc()).all()
    return {"petitions": [serialize_petition(item) for item in petitions]}


def _create_service_order_for_petition(user, petition: Petition, payload: dict) -> ServiceOrder:
    from app.services.client_area_service import _next_reference as next_order_reference
    from app.services.client_area_service import _preview_service_request

    preview = _preview_service_request(
        {
            "tipo_peticao": petition.tipo_peticao,
            "area_direito": petition.area_direito,
            "service_title": petition.tipo_peticao or petition.area_direito,
            "service_code": payload.get("service_code"),
        }
    )
    order = ServiceOrder(
        user_id=user.id,
        petition=petition,
        company_id=user.company_id,
        reference=next_order_reference(),
        status="pendente",
        total_amount=preview["total_amount"],
        deadline_at=_parse_deadline(payload.get("deadline_at")),
    )
    db.session.add(order)
    db.session.flush()

    for item in preview["items"]:
        db.session.add(
            ServiceOrderItem(
                order_id=order.id,
                company_id=user.company_id,
                code=item["code"],
                title=item["title"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                line_total=item["line_total"],
            )
        )

    log_action(
        action="order.created_from_petition",
        entity_type="service_order",
        entity_id=order.id,
        user=user,
        metadata={"reference": order.reference, "petition_reference": petition.reference},
    )
    return order


def _parse_deadline(value: object):
    if not value:
        return None
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed
