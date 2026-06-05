"""Fluxo Express (prazo) e idempotência do submit de pedidos.

Cobre:
- Express PAGO → ServiceOrder ganha prazo de 24h (regressão do early-return
  em _finalize_express_service_order que impedia o prazo de ser aplicado).
- Express NÃO pago após a carência → rebaixa para entrega PADRÃO (mantém
  pendente, grava prazo padrão, remove flag express, mantém crédito).
- Express dentro da carência → permanece como express (deadline None).
- POST /api/petitions com a MESMA idempotency_key não duplica pedido nem
  debita crédito duas vezes.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.models import Order, Petition, ServiceOrder
from app.services import credit_ledger

pytestmark = [pytest.mark.client, pytest.mark.integration]


PAYLOAD_BASE = {
    "area_direito": "Direito Civil",
    "tipo_peticao": "Petição inicial comum",
    "partes": [{"nome": "Autor Teste", "tipo": "Autor"}],
    "resumo_caso": "Caso teste.",
    "detalhes": "Detalhes.",
    "justica_gratuita": False,
    "tutela_urgencia": False,
    "advogado_subscritor": "Dr. Teste",
    "document_ids": [],
}


def _criar_pedido_padrao(api, user) -> int:
    """Cria um pedido PADRÃO (não Express)."""
    resp = api(user).post("/api/petitions", json={**PAYLOAD_BASE, "express_upgrade": False})
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["order"]["id"]


def _dar_credito(user, db, amount=1, key="exp-test"):
    credit_ledger.credit(
        user,
        amount=amount,
        source="test",
        description="Crédito teste",
        idempotency_key=key,
        kind=credit_ledger.KIND_COMMON,
    )
    db.session.commit()


def _criar_pedido_express(api, user) -> int:
    resp = api(user).post("/api/petitions", json={**PAYLOAD_BASE, "express_upgrade": True})
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["order"]["id"]


class TestPadraoDuit:
    def test_pedido_padrao_debita_credito_imediatamente(self, api, client_user, db):
        """Pedido padrão (não-Express) debita crédito logo na criação."""
        _dar_credito(client_user, db, amount=1, key="padrao-debit")
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 1

        # Cria pedido padrão
        order_id = _criar_pedido_padrao(api, client_user)
        service_order = db.session.get(ServiceOrder, order_id)

        # Crédito foi debitado IMEDIATAMENTE
        assert service_order.express_upgrade is False
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

    def test_pedido_padrao_rejeita_sem_credito(self, api, client_user, db):
        """Pedido padrão rejeita criação se não há crédito suficiente."""
        # Cliente sem crédito
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

        resp = api(client_user).post("/api/petitions", json={**PAYLOAD_BASE, "express_upgrade": False})

        # Deve rejeitar com erro de crédito insuficiente (400 ou 422)
        assert resp.status_code in [400, 422], resp.get_json()
        error = resp.get_json()
        assert "insuficiente" in error.get("message", "").lower()


class TestExpressDeadline:
    def test_express_pago_recebe_prazo_24h(self, api, client_user, db):
        # Express é criado SEM debitar crédito ainda.
        order_id = _criar_pedido_express(api, client_user)
        service_order = db.session.get(ServiceOrder, order_id)
        assert service_order.deadline_at is None
        assert service_order.express_upgrade is True
        # Crédito NÃO foi debitado na criação
        from app.services import credit_ledger
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

        # Checkout express vinculado, confirmado como pago.
        # Neste ponto, o cliente já tem crédito suficiente (via plano ou compra anterior).
        _dar_credito(client_user, db, key="exp-paid-checkout")

        checkout = Order(
            user_id=client_user.id,
            service_id="servico_express_upgrade",
            amount=4000,
            currency="BRL",
            status="pending",
            idempotency_key="ck-exp-paid",
            company_id=client_user.company_id,
            service_order_id=service_order.id,
            express_upgrade=True,
        )
        db.session.add(checkout)
        db.session.commit()

        from app.services.checkout_service import _set_paid

        _set_paid(checkout)
        db.session.commit()
        db.session.refresh(service_order)

        # Após pagamento:
        # 1. Prazo de 24h é aplicado
        assert service_order.express_upgrade is True
        assert service_order.deadline_at is not None
        deadline = service_order.deadline_at
        if deadline.tzinfo is None:  # SQLite devolve naive
            deadline = deadline.replace(tzinfo=timezone.utc)
        delta = deadline - datetime.now(timezone.utc)
        assert timedelta(hours=23) < delta < timedelta(hours=25), delta
        # 2. Crédito é debitado
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

    def test_express_nao_pago_rebaixa_para_padrao_apos_carencia(self, api, client_user, db):
        # Express criado SEM débito de crédito
        order_id = _criar_pedido_express(api, client_user)
        service_order = db.session.get(ServiceOrder, order_id)
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

        # Envelhece o pedido além da carência (24h) sem pagamento.
        service_order.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
        db.session.commit()

        # Listar pedidos dispara o fallback preguiçoso.
        resp = api(client_user).get("/api/client-area/orders")
        assert resp.status_code == 200, resp.get_json()
        db.session.refresh(service_order)

        assert service_order.express_upgrade is False
        assert service_order.deadline_at is not None
        # Crédito continua 0 (nunca foi debitado porque Express não foi pago)
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

    def test_express_dentro_da_carencia_nao_rebaixa(self, api, client_user, db):
        order_id = _criar_pedido_express(api, client_user)

        resp = api(client_user).get("/api/client-area/orders")
        assert resp.status_code == 200
        service_order = db.session.get(ServiceOrder, order_id)
        # Recém-criado: continua express, sem prazo, aguardando pagamento.
        # Crédito NÃO foi debitado (esperando pagamento do checkout)
        assert service_order.express_upgrade is True
        assert service_order.deadline_at is None
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0


class TestExpressIdempotence:
    def test_express_webhook_duplicado_nao_duplica_debito(self, api, client_user, db):
        """Replay de webhook de pagamento Express não duplica débito de crédito."""
        order_id = _criar_pedido_express(api, client_user)
        service_order = db.session.get(ServiceOrder, order_id)
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

        # Cria crédito para poder pagar
        _dar_credito(client_user, db, key="exp-webhook-idem")

        # Cria checkout e marca como pago (simula webhook)
        checkout = Order(
            user_id=client_user.id,
            service_id="servico_express_upgrade",
            amount=4000,
            currency="BRL",
            status="pending",
            idempotency_key="ck-webhook-idem",
            company_id=client_user.company_id,
            service_order_id=service_order.id,
            express_upgrade=True,
        )
        db.session.add(checkout)
        db.session.commit()

        from app.services.checkout_service import _set_paid

        # Primeira confirmação de pagamento
        _set_paid(checkout)
        db.session.commit()
        db.session.refresh(service_order)

        assert service_order.deadline_at is not None
        # Crédito foi debitado uma vez
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

        # Simula replay de webhook (mesmo evento processado novamente)
        # _set_paid é idempotente porque verifica order.released_at
        _set_paid(checkout)
        db.session.commit()

        # Crédito ainda está em 0 (não duplicou)
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0


class TestSubmitIdempotente:
    def test_mesma_chave_nao_duplica_nem_debita_2x(self, api, client_user, db):
        _dar_credito(client_user, db, key="idem-credit")
        payload = {**PAYLOAD_BASE, "idempotency_key": "submit-key-123"}

        r1 = api(client_user).post("/api/petitions", json=payload)
        r2 = api(client_user).post("/api/petitions", json=payload)

        assert r1.status_code == 201, r1.get_json()
        assert r2.status_code == 201, r2.get_json()
        # Mesmo pedido devolvido nas duas chamadas.
        assert r1.get_json()["petition"]["id"] == r2.get_json()["petition"]["id"]

        # Exatamente 1 petição e 1 crédito debitado.
        assert Petition.query.filter_by(user_id=client_user.id).count() == 1
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0

    def test_chaves_diferentes_criam_pedidos_distintos(self, api, client_user, db):
        _dar_credito(client_user, db, amount=2, key="idem-credit-2")

        r1 = api(client_user).post("/api/petitions", json={**PAYLOAD_BASE, "idempotency_key": "k-a"})
        r2 = api(client_user).post("/api/petitions", json={**PAYLOAD_BASE, "idempotency_key": "k-b"})

        assert r1.status_code == 201 and r2.status_code == 201
        assert r1.get_json()["petition"]["id"] != r2.get_json()["petition"]["id"]
        assert Petition.query.filter_by(user_id=client_user.id).count() == 2
        assert credit_ledger.compute_balance(client_user.id, kind=credit_ledger.KIND_COMMON) == 0
