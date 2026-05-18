"""Cobertura de /api/petitions (list + create)."""

from __future__ import annotations

import pytest

from app.models import Petition, ServiceOrder


pytestmark = [pytest.mark.client, pytest.mark.integration]


VALID_PAYLOAD = {
    "area_direito": "Direito Civil",
    "tipo_peticao": "Petição inicial comum",
    "partes": [
        {"nome": "Maria Cliente", "tipo": "Autor"},
        {"nome": "Empresa Ré LTDA", "tipo": "Réu"},
    ],
    "resumo_caso": "Disputa contratual sobre serviços prestados.",
    "detalhes": "Cliente requer cumprimento da cláusula 5 do contrato.",
    "justica_gratuita": False,
    "tutela_urgencia": False,
    "advogado_subscritor": "Dr. Silva OAB/SP 123456",
}


# ---------------------------------------------------------------------------
# GET /api/petitions
# ---------------------------------------------------------------------------


class TestListPetitions:
    def test_empty_list_for_new_client(self, api_client):
        response = api_client.get("/api/petitions")
        assert response.status_code == 200
        assert response.get_json()["petitions"] == []

    def test_lists_only_own_petitions(self, api_client, client_user, db):
        from tests.factories import create_client, create_petition

        create_petition(user=client_user, reference="MEU-001")

        other = create_client(email="outro@example.com")
        create_petition(user=other, reference="ALHEIO-001")
        db.session.commit()

        response = api_client.get("/api/petitions")
        refs = [p["reference"] for p in response.get_json()["petitions"]]
        assert "MEU-001" in refs
        assert "ALHEIO-001" not in refs

    def test_anonymous_is_401(self, api_anonymous):
        assert api_anonymous.get("/api/petitions").status_code == 401


# ---------------------------------------------------------------------------
# POST /api/petitions
# ---------------------------------------------------------------------------


@pytest.fixture
def client_with_balance(client_user, db):
    """Credita R$ 1.000,00 ao cliente — suficiente para o pedido padrão (R$ 200)."""
    from tests.factories import create_credit_transaction

    create_credit_transaction(user=client_user, amount=100_000, type="in", source="seed")
    db.session.commit()
    return client_user


class TestCreatePetition:
    def test_creates_petition_with_parties_and_order(
        self, api_client, client_with_balance, db
    ):
        response = api_client.post("/api/petitions", json=VALID_PAYLOAD)
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert body["message"]
        assert body["petition"]["area_direito"] == "Direito Civil"
        # Partes vieram persistidas
        assert len(body["petition"]["partes"]) == 2
        # Ordem de serviço foi criada
        assert body["order"]["id"]
        assert body["order"]["reference"]

        # Persistido no banco
        persisted = Petition.query.filter_by(user_id=client_with_balance.id).first()
        assert persisted is not None
        assert persisted.status == "pendente"

        # Order vinculada à petição
        order = ServiceOrder.query.filter_by(petition_id=persisted.id).first()
        assert order is not None

    def test_missing_area_direito_is_400(self, api_client):
        payload = {**VALID_PAYLOAD, "area_direito": ""}
        response = api_client.post("/api/petitions", json=payload)
        assert response.status_code == 400

    def test_missing_partes_is_400(self, api_client):
        payload = {**VALID_PAYLOAD, "partes": []}
        response = api_client.post("/api/petitions", json=payload)
        assert response.status_code == 400

    def test_party_without_name_is_400(self, api_client):
        payload = {**VALID_PAYLOAD, "partes": [{"nome": "", "tipo": "Autor"}]}
        response = api_client.post("/api/petitions", json=payload)
        assert response.status_code == 400

    def test_party_without_tipo_is_400(self, api_client):
        payload = {**VALID_PAYLOAD, "partes": [{"nome": "X", "tipo": ""}]}
        response = api_client.post("/api/petitions", json=payload)
        assert response.status_code == 400

    def test_with_uploaded_documents(self, api_client, client_with_balance, db):
        """Documentos pré-uploaded podem ser vinculados via document_ids."""
        from tests.factories import create_document

        doc = create_document(user=client_with_balance, file_name="anexo.pdf")
        db.session.commit()

        payload = {**VALID_PAYLOAD, "document_ids": [doc.id]}
        response = api_client.post("/api/petitions", json=payload)
        assert response.status_code == 201
        documents = response.get_json()["petition"]["documents"]
        assert any(d["id"] == doc.id for d in documents)

    def test_cannot_attach_other_users_document(self, api_client, db):
        """Tentativa de vincular documento de outro usuário é bloqueada."""
        from tests.factories import create_client, create_document

        other = create_client(email="outro@example.com")
        doc = create_document(user=other, file_name="alheio.pdf")
        db.session.commit()

        payload = {**VALID_PAYLOAD, "document_ids": [doc.id]}
        response = api_client.post("/api/petitions", json=payload)
        assert response.status_code in (400, 404, 403)

    def test_plan_limit_blocks_extra_petitions(self, api_client, client_with_balance, db):
        """Plano com limite mensal definido deve bloquear quando atingido."""
        from tests.factories import create_petition, create_plan

        plan = create_plan(petition_limit_monthly=1)
        client_with_balance.active_plan_id = plan.id

        # já tem 1 petição este mês
        create_petition(user=client_with_balance)
        db.session.commit()

        response = api_client.post("/api/petitions", json=VALID_PAYLOAD)
        assert response.status_code == 422  # PLAN_LIMIT_EXCEEDED
        assert response.get_json()["error"] == "PLAN_LIMIT_EXCEEDED"

    def test_anonymous_blocked(self, api_anonymous):
        response = api_anonymous.post("/api/petitions", json=VALID_PAYLOAD)
        assert response.status_code == 401
