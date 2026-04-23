from __future__ import annotations

from app.core.errors import PermissionDenied, ValidationError
from app.core.extensions import db
from app.domain.permissions import scoped_query
from app.domain.plan_rules import ensure_plan_allows_new_petition
from app.models import Document, Petition, PetitionDocumentLink, PetitionParty
from app.services.audit_service import log_action
from app.services.serializers import serialize_petition


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
    required_fields = {
        "area_direito": "Área do Direito é obrigatória.",
        "advogado_subscritor": "Advogado subscritor é obrigatório.",
        "resumo_caso": "Resumo do caso é obrigatório.",
        "detalhes": "Detalhes são obrigatórios.",
    }
    for field, message in required_fields.items():
        if not (payload.get(field) or "").strip():
            raise ValidationError(message)

    parties = payload.get("partes") or []
    if not isinstance(parties, list) or not parties:
        raise ValidationError("Informe ao menos uma parte.")

    ensure_plan_allows_new_petition(user)
    documents = _validate_document_ids(user, [int(item) for item in payload.get("document_ids", [])])

    petition = Petition(
        user_id=user.id,
        company_id=user.company_id,
        reference=_next_reference(),
        area_direito=payload["area_direito"].strip(),
        tipo_peticao=(payload.get("tipo_peticao") or "").strip() or None,
        numero_processo=(payload.get("numero_processo") or "").strip() or None,
        data_publicacao=(payload.get("data_publicacao") or "").strip() or None,
        justica_gratuita=bool(payload.get("justica_gratuita")),
        tutela_urgencia=bool(payload.get("tutela_urgencia")),
        advogado_subscritor=payload["advogado_subscritor"].strip(),
        resumo_caso=payload["resumo_caso"].strip(),
        detalhes=payload["detalhes"].strip(),
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

    log_action(
        action="petition.created",
        entity_type="petition",
        entity_id=petition.id,
        user=user,
        metadata={"reference": petition.reference, "status": petition.status},
    )
    db.session.commit()
    return {"message": "Petição criada com sucesso.", "petition": serialize_petition(petition)}


def list_petitions(user) -> dict:
    petitions = scoped_query(Petition, user).order_by(Petition.created_at.desc()).all()
    return {"petitions": [serialize_petition(item) for item in petitions]}
