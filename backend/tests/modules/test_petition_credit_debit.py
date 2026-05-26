"""Testes da criação de petições e débito automático de créditos.

Valida que:
- POST /api/petitions com crédito disponível → 201, débita 1 crédito common
- POST express → débita 1 crédito common + cria ordem com status pendente_pagamento_express
- Erro sem crédito suficiente inclui mensagem orientadora
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

    def test_order_status_is_pendente_for_regular(self, api, client_with_common_credit, db):
        response = api(client_with_common_credit).post(
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
        order = response.get_json()["order"]
        assert order["status"] == "pendente"
        assert order["express_upgrade"] is False


# ---------------------------------------------------------------------------
# Erro sem crédito
# ---------------------------------------------------------------------------


class TestCreatePetitionWithoutCredit:
    """POST /api/petitions sem crédito → erro com mensagem orientadora."""

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
# Express: débita common + cria pendente_pagamento_express
# ---------------------------------------------------------------------------


class TestCreateExpressPetition:
    """POST express → débita 1 crédito common e cria ordem com pendente_pagamento_express."""

    def test_express_debits_common_credit(self, api, client_user, db):
        credit_ledger.credit(
            client_user, amount=1,
            source="test", description="Common for express",
            idempotency_key="exp-common-1",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Contestação",
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
        assert order["status"] == "pendente_pagamento_express"
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

    def test_express_with_grupo_b_also_debits_common(self, api, client_user, db):
        credit_ledger.credit(
            client_user, amount=1,
            source="test", description="Common for express B",
            idempotency_key="exp-b-common-1",
            kind=credit_ledger.KIND_COMMON,
        )
        db.session.flush()

        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Apelação",
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
        assert order["status"] == "pendente_pagamento_express"
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

    def test_express_without_common_credit_returns_error(self, api, client_user, db):
        response = api(client_user).post(
            "/api/petitions",
            json={
                "area_direito": "Direito Civil",
                "tipo_peticao": "Contestação",
                "partes": [{"nome": "Tom", "tipo": "Réu"}],
                "resumo_caso": "No credits",
                "detalhes": "Test",
                "justica_gratuita": False,
                "tutela_urgencia": False,
                "advogado_subscritor": "Dr. Slow",
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
