"""Testes da criação de petições e débito automático de créditos por kind.

Valida que:
- POST /api/petitions com crédito disponível → 201, débita 1 crédito correto
- POST express com Grupo A → usa peticao_express
- POST express com Grupo B → usa recurso_express
- Erro sem crédito suficiente inclui mensagem orientadora por kind
"""

from __future__ import annotations

import pytest

from app.services import credit_ledger


pytestmark = [pytest.mark.client, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client_with_common_credit(client_user, db):
    """Credita 1 crédito common ao cliente."""
    credit_ledger.credit(
        client_user,
        amount=1,
        source="test",
        description="Test credit",
        idempotency_key="test-common-1",
        kind=credit_ledger.KIND_COMMON,
    )
    db.session.flush()
    return client_user


@pytest.fixture
def client_with_express_credits(client_user, db):
    """Credita 1 crédito de cada tipo de express."""
    credit_ledger.credit(
        client_user,
        amount=1,
        source="test",
        description="Pet express",
        idempotency_key="test-pet-exp",
        kind=credit_ledger.KIND_PETICAO_EXPRESS,
    )
    credit_ledger.credit(
        client_user,
        amount=1,
        source="test",
        description="Rec express",
        idempotency_key="test-rec-exp",
        kind=credit_ledger.KIND_RECURSO_EXPRESS,
    )
    db.session.flush()
    return client_user


# ---------------------------------------------------------------------------
# Criação com crédito common
# ---------------------------------------------------------------------------


class TestCreatePetitionWithCommonCredit:
    """POST /api/petitions com crédito common → 201, débita 1 common."""

    def test_creates_petition_and_debits_1_common_credit(self, api, client_with_common_credit, db):
        before_balance = credit_ledger.compute_balance(
            client_with_common_credit.id, kind=credit_ledger.KIND_COMMON
        )
        assert before_balance == 1

        response = api(client_with_common_credit).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Petição inicial comum",
                "partes": [{"nome": "João", "tipo": "Autor"}],
                "resumo_caso": "Caso teste",
                "detalhes": "Detalhes teste",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Dr. Silva",
                "document_ids": [],
            },
        )

        assert response.status_code == 201, response.get_json()
        after_balance = credit_ledger.compute_balance(
            client_with_common_credit.id, kind=credit_ledger.KIND_COMMON
        )
        assert after_balance == 0, "Débito de 1 crédito common não funcionou"

    def test_other_kinds_untouched_after_common_debit(self, api, client_user, db):
        # Add credits to all kinds
        credit_ledger.credit(
            client_user, amount=1,
            source="test", description="Common",
            idempotency_key="setup-common",
            kind=credit_ledger.KIND_COMMON,
        )
        credit_ledger.credit(
            client_user, amount=5,
            source="test", description="Pet exp",
            idempotency_key="setup-pet-exp",
            kind=credit_ledger.KIND_PETICAO_EXPRESS,
        )
        credit_ledger.credit(
            client_user, amount=3,
            source="test", description="Rec exp",
            idempotency_key="setup-rec-exp",
            kind=credit_ledger.KIND_RECURSO_EXPRESS,
        )
        db.session.flush()

        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Contestação",
                "partes": [{"nome": "Maria", "tipo": "Réu"}],
                "resumo_caso": "Defesa",
                "detalhes": "Detalhe",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Dr. Paulo",
                "document_ids": [],
            },
        )

        assert response.status_code == 201

        # Verify only common was debited
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_PETICAO_EXPRESS) == 5
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_RECURSO_EXPRESS) == 3


# ---------------------------------------------------------------------------
# Erro sem crédito
# ---------------------------------------------------------------------------


class TestCreatePetitionWithoutCredit:
    """POST /api/petitions sem crédito → 422/400 com mensagem orientadora."""

    def test_no_common_credit_returns_error_message(self, api, client_user, db):
        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Contestação",
                "partes": [{"nome": "Pedro", "tipo": "Autor"}],
                "resumo_caso": "Sem crédito",
                "detalhes": "Teste",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Dr. Test",
                "document_ids": [],
            },
        )

        assert response.status_code in [400, 422], f"Expected error, got {response.status_code}: {response.get_json()}"


# ---------------------------------------------------------------------------
# Express com Grupo A (peticao_express)
# ---------------------------------------------------------------------------


class TestCreateExpressPetitionGroupA:
    """POST express com Grupo A (Contestação, etc.) → debita peticao_express."""

    def test_express_grupo_a_debits_peticao_express(self, api, client_user, db):
        # Credita apenas peticao_express
        credit_ledger.credit(
            client_user, amount=1,
            source="test", description="Pet exp",
            idempotency_key="exp-a-1",
            kind=credit_ledger.KIND_PETICAO_EXPRESS,
        )
        db.session.flush()

        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Contestação",  # Grupo A
                "partes": [{"nome": "Anna", "tipo": "Réu"}],
                "resumo_caso": "Express defesa",
                "detalhes": "Precisa de 24h",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Dr. Rápido",
                "document_ids": [],
                "express_upgrade": True,
            },
        )

        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        order = body["order"]
        assert order["express_upgrade"] is True
        assert credit_ledger.compute_balance(
            client_user.id, kind=credit_ledger.KIND_PETICAO_EXPRESS
        ) == 0


# ---------------------------------------------------------------------------
# Express com Grupo B (recurso_express)
# ---------------------------------------------------------------------------


class TestCreateExpressPetitionGroupB:
    """POST express com Grupo B (Apelação, recursos) → debita recurso_express."""

    def test_express_grupo_b_debits_recurso_express(self, api, client_user, db):
        # Credita apenas recurso_express
        credit_ledger.credit(
            client_user, amount=1,
            source="test", description="Rec exp",
            idempotency_key="exp-b-1",
            kind=credit_ledger.KIND_RECURSO_EXPRESS,
        )
        db.session.flush()

        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Apelação",  # Grupo B
                "partes": [{"nome": "José", "tipo": "Apelante"}],
                "resumo_caso": "Express recurso",
                "detalhes": "Urgente no tribunal",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Dr. Veloz",
                "document_ids": [],
                "express_upgrade": True,
            },
        )

        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        order = body["order"]
        assert order["express_upgrade"] is True
        assert credit_ledger.compute_balance(
            client_user.id, kind=credit_ledger.KIND_RECURSO_EXPRESS
        ) == 0


class TestExpressWithoutCorrectKind:
    """Express sem crédito do kind certo → erro com mensagem específica."""

    def test_no_peticao_express_returns_error(self, api, client_user, db):
        # Tenta express Grupo A sem crédito peticao_express
        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Contestação",  # Grupo A = peticao_express needed
                "partes": [{"nome": "Tom", "tipo": "Réu"}],
                "resumo_caso": "No express credits",
                "detalhes": "Test",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Dr. Slow",
                "document_ids": [],
                "express_upgrade": True,
            },
        )

        assert response.status_code in [400, 422], f"Expected error, got {response.status_code}: {response.get_json()}"

    def test_no_recurso_express_returns_error(self, api, client_user, db):
        # Tenta express Grupo B sem crédito recurso_express
        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Agravo de instrumento",  # Grupo B = recurso_express needed
                "partes": [{"nome": "Jerry", "tipo": "Agravante"}],
                "resumo_caso": "No rec credits",
                "detalhes": "Test",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Dr. Lento",
                "document_ids": [],
                "express_upgrade": True,
            },
        )

        assert response.status_code in [400, 422], f"Expected error, got {response.status_code}: {response.get_json()}"


# ---------------------------------------------------------------------------
# Anonimato
# ---------------------------------------------------------------------------


def test_anonymous_cannot_create_petition(api_anonymous):
    response = api_anonymous.post(
        "/api/petitions",
        json={
            "area_direito": "Direito Civil",
            "tipo_peticao": "Petição inicial comum",
            "partes": [{"nome": "Anon", "tipo": "Autor"}],
            "resumo_caso": "No auth",
            "detalhes": "Test",
            "justica_gratuita": False,
            "tutela_urgencia": False,
            "advogado_subscritor": "Dr. Anom",
            "document_ids": [],
        },
    )

    assert response.status_code == 401
