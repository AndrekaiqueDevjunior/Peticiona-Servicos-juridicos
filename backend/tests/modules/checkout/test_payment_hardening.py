"""Testes do hardening de pagamento — 3 achados de paranoia justificada:

1. Idempotency-Key da Pagar.me é ESTÁVEL (retry martelado da MESMA tentativa
   reusa a mesma chave; Pagar.me devolve a Order anterior em vez de criar
   várias no painel).

2. Detector de Orders órfãos em `processing` sem `pagarme_order_id` (cenário
   de crash entre `order.status = "processing"` e a chamada ao gateway) —
   roda em `run_runtime_migrations` no boot do backend.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.extensions import db
from app.models import Order
from tests.factories import create_client


pytestmark = pytest.mark.checkout


# ---------------------------------------------------------------------------
# 1. Idempotency-Key estável
# ---------------------------------------------------------------------------


class TestStableIdempotencyKey:
    @pytest.fixture
    def order(self, app, db_session=None):
        u = create_client(email="payhard@x.com")
        db.session.commit()
        o = Order(
            user_id=u.id,
            company_id=u.company_id,
            service_id="plano_essencial",
            amount=48000,
            currency="BRL",
            status="pending",
            idempotency_key=f"checkout-order-{u.id}-test",
        )
        db.session.add(o)
        db.session.commit()
        return o

    def test_payment_attempts_inicia_em_zero(self, order):
        assert order.payment_attempts == 0

    def test_payment_attempts_incrementa_a_cada_tentativa(self, order, monkeypatch):
        """create_checkout_payment incrementa o contador e usa no
        idempotency_key. Mockamos PagarmeClient pra não chamar rede."""
        from app.services import checkout_service
        from app.services.checkout_service import create_checkout_payment

        captured_keys = []

        class FakeClient:
            def create_order(self, payload, *, idempotency_key):
                captured_keys.append(idempotency_key)
                # Simula recusa de cartão pra forçar retry posterior
                return {
                    "id": f"or_test_{len(captured_keys)}",
                    "status": "failed",
                    "charges": [{"id": f"ch_{len(captured_keys)}", "status": "failed"}],
                }

        monkeypatch.setattr(checkout_service, "PagarmeClient", lambda: FakeClient())

        user = order.user
        payload = {
            "order_id": order.id,
            "payment_method": "credit_card",
            "card": {"token": "tok_test", "installments": 1},
            "buyer": {"fullName": "Cliente Teste", "email": "x@y.com", "cpf": "11122233344", "phone": "11999998888"},
            "billing_address": {
                "street": "Rua X", "street_number": "1", "neighborhood": "Y",
                "city": "São Paulo", "state": "SP", "zip_code": "01310100", "country": "BR",
            },
        }

        # 1ª tentativa
        body1, _ = create_checkout_payment(user, payload)
        db.session.refresh(order)
        assert order.payment_attempts == 1
        assert captured_keys[0] == f"checkout-payment-{order.id}-1"

        # 2ª tentativa (após 1 ter falhado, status fica 'failed' → permite retry)
        body2, _ = create_checkout_payment(user, payload)
        db.session.refresh(order)
        assert order.payment_attempts == 2
        assert captured_keys[1] == f"checkout-payment-{order.id}-2"
        # Keys de tentativas distintas são distintas (esperado)
        assert captured_keys[0] != captured_keys[1]


# ---------------------------------------------------------------------------
# 2. Detector de Orders órfãos
# ---------------------------------------------------------------------------


class TestOrphanProcessingReset:
    def test_revertem_orders_processing_sem_pagarme_id_antigas(self, app, db_session=None):
        """Order que ficou `processing` sem `pagarme_order_id` e há mais de
        15min é revertida para `pending` no boot via
        `_reset_orphan_processing_orders`."""
        from app.bootstrap.migrations import _reset_orphan_processing_orders

        u = create_client(email="orphan@x.com")
        db.session.commit()

        # Cria 3 Orders em estados diferentes pra checar o filtro:
        # 1. processing sem pagarme_order_id, antigo → DEVE reverter
        # 2. processing sem pagarme_order_id, recente → NÃO reverter
        # 3. processing COM pagarme_order_id, antigo → NÃO reverter
        agora = datetime.now(timezone.utc)
        antigo = agora - timedelta(minutes=30)
        recente = agora - timedelta(minutes=5)

        o_antigo_orfao = Order(
            user_id=u.id, company_id=u.company_id, service_id="plano_essencial",
            amount=48000, currency="BRL", status="processing",
            idempotency_key="t1",
        )
        o_recente_orfao = Order(
            user_id=u.id, company_id=u.company_id, service_id="plano_essencial",
            amount=48000, currency="BRL", status="processing",
            idempotency_key="t2",
        )
        o_antigo_com_id = Order(
            user_id=u.id, company_id=u.company_id, service_id="plano_essencial",
            amount=48000, currency="BRL", status="processing",
            pagarme_order_id="or_real_xpto", idempotency_key="t3",
        )
        db.session.add_all([o_antigo_orfao, o_recente_orfao, o_antigo_com_id])
        db.session.commit()

        # Força updated_at pra simular antiguidade (TimestampMixin atualiza
        # automaticamente; usamos UPDATE direto pra escapar do auto-set).
        db.session.execute(
            db.text("UPDATE orders SET updated_at = :ts WHERE id = :id"),
            {"ts": antigo, "id": o_antigo_orfao.id},
        )
        db.session.execute(
            db.text("UPDATE orders SET updated_at = :ts WHERE id = :id"),
            {"ts": recente, "id": o_recente_orfao.id},
        )
        db.session.execute(
            db.text("UPDATE orders SET updated_at = :ts WHERE id = :id"),
            {"ts": antigo, "id": o_antigo_com_id.id},
        )
        db.session.commit()

        # Roda o detector
        _reset_orphan_processing_orders()
        db.session.commit()

        # Verifica: só o antigo+órfão foi revertido
        db.session.refresh(o_antigo_orfao)
        db.session.refresh(o_recente_orfao)
        db.session.refresh(o_antigo_com_id)
        assert o_antigo_orfao.status == "pending", "Order antiga e órfã deve virar pending"
        assert o_recente_orfao.status == "processing", "Order recente NÃO deve mexer"
        assert o_antigo_com_id.status == "processing", "Order com pagarme_order_id NÃO deve mexer"
