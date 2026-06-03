"""Smoke test: prazo de entrega calculado corretamente ao criar petição.

Valida que:
  - Cliente sem plano (avulso) → deadline ≈ 3 dias úteis
  - Cliente com plano_estrategico → deadline ≈ 2 dias úteis
  - Express → deadline_at = None (definido só após pagamento)
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.models import ServiceOrder
from app.services.prazos_service import calcular_prazo_entrega


PAYLOAD_BASE = {
    "area_direito": "Direito Civil",
    "tipo_peticao": "Petição inicial comum",
    "partes": [{"nome": "Autor Teste", "tipo": "Autor"}],
    "resumo_caso": "Smoke test de prazo.",
    "detalhes": "Verificação automática.",
    "justica_gratuita": False,
    "tutela_urgencia": False,
}


def _deadline_date(order_deadline: datetime) -> "date":
    from datetime import date
    if order_deadline.tzinfo is None:
        order_deadline = order_deadline.replace(tzinfo=timezone.utc)
    return order_deadline.date()


def _dar_credito(user, db):
    from app.services import credit_ledger
    credit_ledger.credit(
        user,
        amount=5,
        source="admin_grant",
        description="Crédito smoke test",
        idempotency_key=f"smoke-{user.id}",
    )
    db.session.flush()


# ---------------------------------------------------------------------------


class TestPrazoAocriarPeticao:

    def test_sem_plano_recebe_3_dias_uteis(self, api_client, client_user, db):
        _dar_credito(client_user, db)
        db.session.commit()

        inicio = datetime.now(timezone.utc)
        resp = api_client.post("/api/petitions", json=PAYLOAD_BASE)
        assert resp.status_code == 201, resp.get_json()

        order_id = resp.get_json()["order"]["id"]
        order = db.session.get(ServiceOrder, order_id)

        assert order.deadline_at is not None, "deadline_at não foi definido"
        esperado = calcular_prazo_entrega("avulso", inicio).date()
        assert _deadline_date(order.deadline_at) == esperado, (
            f"Esperado {esperado} (3 dias úteis), obtido {_deadline_date(order.deadline_at)}"
        )

    def test_plano_estrategico_recebe_2_dias_uteis(self, api_client, client_user, db):
        from tests.factories import create_plan

        plano = create_plan(code="plano_estrategico", name="Plano Premium")
        client_user.active_plan = plano
        _dar_credito(client_user, db)
        db.session.commit()

        inicio = datetime.now(timezone.utc)
        resp = api_client.post("/api/petitions", json=PAYLOAD_BASE)
        assert resp.status_code == 201, resp.get_json()

        order_id = resp.get_json()["order"]["id"]
        order = db.session.get(ServiceOrder, order_id)

        assert order.deadline_at is not None, "deadline_at não foi definido"
        esperado = calcular_prazo_entrega("estrategico", inicio).date()
        assert _deadline_date(order.deadline_at) == esperado, (
            f"Esperado {esperado} (2 dias úteis), obtido {_deadline_date(order.deadline_at)}"
        )

    def test_express_deadline_none_ate_pagamento(self, api_client, client_user, db):
        _dar_credito(client_user, db)
        db.session.commit()

        payload = {**PAYLOAD_BASE, "express_upgrade": True}
        resp = api_client.post("/api/petitions", json=payload)
        assert resp.status_code == 201, resp.get_json()

        order_id = resp.get_json()["order"]["id"]
        order = db.session.get(ServiceOrder, order_id)

        assert order.deadline_at is None, (
            f"Express não deve ter deadline antes do pagamento, mas tem {order.deadline_at}"
        )
        assert order.express_upgrade is True
