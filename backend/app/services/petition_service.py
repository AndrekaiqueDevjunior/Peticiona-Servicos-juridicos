from __future__ import annotations

from datetime import datetime, timezone

from app.core.errors import PermissionDenied, ValidationError
from app.core.extensions import db
from app.domain.permissions import scoped_query
from app.domain.plan_rules import ensure_plan_allows_new_petition
from app.models import Document, Petition, PetitionDocumentLink, PetitionParty, ServiceOrder, ServiceOrderItem
from app.services.audit_service import log_action
from app.services.serializers import serialize_order, serialize_petition


def _placeholder_reference() -> str:
    """Placeholder único pra reference enquanto o INSERT acontece.

    A reference humana definitiva (``PET-NNNNNN``) é atribuída
    *depois* do flush, derivada do ``petition.id`` (atômico no banco).
    Ver app.core.references e o fluxo em ``create_petition``.
    """
    from app.core.references import temporary_reference

    return temporary_reference("PET")


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

    from app.core.references import human_reference

    petition = Petition(
        user_id=user.id,
        company_id=user.company_id,
        reference=_placeholder_reference(),
        area_direito=area_direito,
        tipo_peticao=(payload.get("tipo_peticao") or "").strip() or None,
        numero_processo=(payload.get("numero_processo") or "").strip() or None,
        data_publicacao=(payload.get("data_publicacao") or "").strip() or None,
        competencia=(payload.get("competencia") or "").strip() or None,
        comarca_uf=(payload.get("comarca_uf") or "").strip() or None,
        justica_gratuita=bool(payload.get("justica_gratuita")),
        tutela_urgencia=bool(payload.get("tutela_urgencia")),
        advogado_subscritor=(payload.get("advogado_subscritor") or "").strip() or None,
        resumo_caso=(payload.get("resumo_caso") or "").strip() or None,
        detalhes=(payload.get("detalhes") or "").strip() or None,
        status="pendente",
    )
    db.session.add(petition)
    db.session.flush()
    # Reference definitiva derivada do `id` atômico do banco — só agora
    # é seguro montar a string humana sem race com requisições paralelas.
    petition.reference = human_reference("PET", petition.id)
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
    from app.core.errors import ValidationError
    from app.core.references import human_reference
    from app.services import credit_ledger
    from app.services.client_area_service import (
        _placeholder_order_reference,
        _preview_service_request,
    )
    from app.services.serializers import format_brl_from_cents

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
        reference=_placeholder_order_reference(),
        status="pendente",
        total_amount=preview["total_amount"],
        deadline_at=_parse_deadline(payload.get("deadline_at")),
    )
    db.session.add(order)
    db.session.flush()
    order.reference = human_reference("ORD", order.id)
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

    # Débito via credit_ledger: o gate de saldo, o advisory lock por
    # usuário e a idempotência por (order.reference) são responsabilidade
    # do módulo. Mantém a ordem antiga (sem cobrança em pedidos de valor
    # zero) e converte InsufficientBalance em ValidationError com a
    # mesma mensagem que a UI já estava acostumada a tratar.
    if preview["total_amount"] > 0 and user is not None:
        service_title = petition.tipo_peticao or petition.area_direito or "Serviço jurídico"
        try:
            credit_ledger.debit(
                user,
                amount=preview["total_amount"],
                source="client_order",
                description=f"Débito — {order.reference} ({service_title})",
                idempotency_key=f"order-debit-{order.reference}",
            )
        except credit_ledger.InsufficientBalance as exc:
            raise ValidationError(
                f"Saldo insuficiente. Disponível: {format_brl_from_cents(max(0, exc.available))}. "
                f"Necessário: {format_brl_from_cents(exc.required)}."
            ) from exc

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
