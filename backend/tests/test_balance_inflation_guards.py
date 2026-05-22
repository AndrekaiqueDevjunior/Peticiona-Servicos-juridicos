"""Testes dos 2 guards preventivos contra inflação de saldo:

1. Webhook detection de produção tem default fail-secure (DEBUG=False
   implícito → exige HMAC). Antes o default era True, deixando uma
   janela onde config esquecida em prod aceitava webhook só com token.

2. Admin form de planos recusa monthly_credits_cents > 2x
   monthly_price_cents (prevenção contra erro humano que viraria
   inflação de saldo automática quando o cliente comprasse o plano).
"""

from __future__ import annotations

import json

import pytest

from app.core.errors import ValidationError
from app.services.admin_service import _validate_plan_credit_ratio


# ---------------------------------------------------------------------------
# Fix 1 — webhook fail-secure default
# ---------------------------------------------------------------------------


class TestWebhookFailSecureDefault:
    def test_webhook_em_prod_sem_assinatura_recusa(self, api_anonymous, app, monkeypatch):
        """Mesmo SEM token, SEM signature, e SEM DEBUG/ENV setados, o
        endpoint deve exigir HMAC (fail-secure). Antes esse mesmo
        cenário aceitava token-only."""
        # Apaga ENV e DEBUG do config — simula prod mal configurada
        monkeypatch.setitem(app.config, "DEBUG", None)
        monkeypatch.setitem(app.config, "ENV", None)

        response = api_anonymous.post(
            "/api/webhooks/pagarme",
            json={"id": "ev_test", "type": "order.paid", "data": {}},
        )
        # Sem signature, deve recusar (status 4xx) — não passar pelo
        # fluxo do token-fallback de dev.
        assert response.status_code in (400, 401, 403), (
            f"deveria recusar webhook sem signature em prod (mesmo com "
            f"DEBUG/ENV ausentes); obteve {response.status_code} "
            f"body={response.get_data(as_text=True)[:150]}"
        )

    def test_webhook_em_debug_explicito_ainda_aceita_token(self, api_anonymous, app, monkeypatch):
        """Quando DEBUG está EXPLICITAMENTE True (dev real), o token
        continua sendo válido como fallback. Não regredimos a UX dev."""
        monkeypatch.setitem(app.config, "DEBUG", True)
        monkeypatch.setitem(app.config, "ENV", None)
        # Configura um token pra validação passar
        monkeypatch.setitem(app.config, "PAGARME_WEBHOOK_TOKEN", "dev-token-123")

        payload = {"id": "ev_dev", "type": "order.paid", "data": {}}
        response = api_anonymous.post(
            "/api/webhooks/pagarme",
            json=payload,
            headers={"X-Pagarme-Webhook-Token": "dev-token-123"},
        )
        # Token correto + DEBUG=True → deve processar (200) ou 422 do payload mal
        # formado (mas NÃO 401/403 do gate).
        assert response.status_code in (200, 422), (
            f"em dev com token correto deveria passar do gate; "
            f"obteve {response.status_code}"
        )


# ---------------------------------------------------------------------------
# Fix 2 — guard de ratio crédito/preço em planos
# ---------------------------------------------------------------------------


class TestPlanCreditRatioGuard:
    def test_ratio_1_para_1_passa(self):
        """48000 / 48000 = 1.0 (plano essencial atual). Caso normal."""
        _validate_plan_credit_ratio(monthly_price_cents=48000, monthly_credits_cents=48000)

    def test_promocao_legitima_passa(self):
        """100 paga, 150 em crédito = 1.5x. Promoção 'ganhe 50% extra' — OK."""
        _validate_plan_credit_ratio(monthly_price_cents=10000, monthly_credits_cents=15000)

    def test_ratio_exatamente_2_passa(self):
        """Limite superior inclusivo: 2.0x ainda é aceito."""
        _validate_plan_credit_ratio(monthly_price_cents=10000, monthly_credits_cents=20000)

    def test_ratio_acima_de_2_recusa(self):
        """2.01x já é negado — provável erro de digitação."""
        with pytest.raises(ValidationError, match="excede o teto"):
            _validate_plan_credit_ratio(monthly_price_cents=10000, monthly_credits_cents=20001)

    def test_erro_grosseiro_recusa(self):
        """R$ 1 pagaria R$ 9.999.999,99 em crédito. Bloqueia."""
        with pytest.raises(ValidationError, match="excede o teto"):
            _validate_plan_credit_ratio(monthly_price_cents=100, monthly_credits_cents=999_999_999)

    def test_preco_zero_com_credito_recusa(self):
        """Plano grátis (price=0) com qualquer crédito > 0 é bloqueado:
        cliente compraria grátis e ganharia saldo sem cobertura financeira."""
        with pytest.raises(ValidationError, match="sem preço"):
            _validate_plan_credit_ratio(monthly_price_cents=0, monthly_credits_cents=1)

    def test_preco_zero_com_credito_zero_passa(self):
        """Plano legítimo grátis (sem nenhum crédito) — ex.: plano que
        só dá benefícios não-financeiros — passa."""
        _validate_plan_credit_ratio(monthly_price_cents=0, monthly_credits_cents=0)


# ---------------------------------------------------------------------------
# Integração ponta-a-ponta: admin não consegue criar plano fraudulento
# ---------------------------------------------------------------------------


class TestAdminPlanCreateGuardIntegration:
    def test_admin_recusa_create_de_plano_fraudulento(
        self, api_admin, db
    ):
        """POST /admin/plans com ratio acima do teto retorna 400."""
        response = api_admin.post(
            "/api/admin/plans",
            json={
                "code": "plano_fraudulento_teste",
                "name": "Tentativa de fraude",
                "monthly_price_cents": 1000,  # R$ 10
                "monthly_credits_cents": 100_000_000,  # R$ 1.000.000 (1.000.000x)
            },
        )
        assert response.status_code == 400, response.get_data(as_text=True)
        assert "teto" in response.get_json()["message"].lower()

    def test_admin_recusa_update_para_ratio_invalido(
        self, api_admin, db
    ):
        """PUT /admin/plans/<id> com ratio acima do teto retorna 400.
        Cobre o caso 'atualizou credits sem rever price'."""
        # Cria plano normal
        create = api_admin.post(
            "/api/admin/plans",
            json={
                "code": "plano_para_atualizar",
                "name": "Plano normal",
                "monthly_price_cents": 10000,
                "monthly_credits_cents": 10000,
            },
        )
        assert create.status_code in (200, 201), create.get_data(as_text=True)
        plan_id = create.get_json()["plan"]["id"]

        # Tenta inflar via update
        update = api_admin.put(
            f"/api/admin/plans/{plan_id}",
            json={"monthly_credits_cents": 999_999},  # ~100x do preço
        )
        assert update.status_code == 400, update.get_data(as_text=True)
        assert "teto" in update.get_json()["message"].lower()
