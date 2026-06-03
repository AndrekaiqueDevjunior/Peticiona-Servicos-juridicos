"""Testes do módulo app.services.prazos_service.

Cobre:
  1. calcular_prazo_entrega — dias úteis corretos por modalidade
  2. calcular_prazo_entrega — pula fins de semana e feriados fixos
  3. modalidade_para_prazo — mapeamento plano → modalidade
  4. modalidade_para_prazo — fallback sem plano = 'avulso'
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

import pytest

from app.services.prazos_service import (
    calcular_prazo_entrega,
    calcular_prazo_interno,
    modalidade_para_prazo,
)


# ---------------------------------------------------------------------------
# calcular_prazo_entrega
# ---------------------------------------------------------------------------

def test_avulso_3_dias_uteis_semana_normal():
    # Segunda-feira → prazo cai na quinta (3 dias úteis)
    inicio = datetime(2025, 6, 2, 12, 0, tzinfo=timezone.utc)  # segunda
    prazo = calcular_prazo_entrega("avulso", inicio)
    assert prazo.weekday() == 3  # quinta-feira
    delta = prazo - inicio
    assert delta.days == 3


def test_estrategico_2_dias_uteis():
    # Segunda → prazo cai na quarta (2 dias úteis)
    inicio = datetime(2025, 6, 2, 12, 0, tzinfo=timezone.utc)  # segunda
    prazo = calcular_prazo_entrega("estrategico", inicio)
    assert prazo.weekday() == 2  # quarta-feira
    delta = prazo - inicio
    assert delta.days == 2


def test_essencial_igual_avulso():
    inicio = datetime(2025, 6, 2, 12, 0, tzinfo=timezone.utc)
    assert calcular_prazo_entrega("essencial", inicio) == calcular_prazo_entrega("avulso", inicio)


def test_profissional_igual_avulso():
    inicio = datetime(2025, 6, 2, 12, 0, tzinfo=timezone.utc)
    assert calcular_prazo_entrega("profissional", inicio) == calcular_prazo_entrega("avulso", inicio)


def test_pula_fim_de_semana():
    # Sexta-feira → 3 dias úteis cai na quarta seguinte (pula sáb+dom)
    inicio = datetime(2025, 6, 6, 12, 0, tzinfo=timezone.utc)  # sexta
    prazo = calcular_prazo_entrega("avulso", inicio)
    assert prazo.weekday() == 2  # quarta


def test_pula_feriado_fixo_natal():
    # 22/dez (seg) → 3 dias úteis: 23 (ter), 24 (qua), 26 (sex, pula 25/dez Natal)
    inicio = datetime(2025, 12, 22, 12, 0, tzinfo=timezone.utc)
    prazo = calcular_prazo_entrega("avulso", inicio)
    assert prazo.date() == datetime(2025, 12, 26, tzinfo=timezone.utc).date()


def test_modalidade_desconhecida_fallback_3_dias():
    inicio = datetime(2025, 6, 2, 12, 0, tzinfo=timezone.utc)
    prazo = calcular_prazo_entrega("inexistente", inicio)
    assert prazo == calcular_prazo_entrega("avulso", inicio)


# ---------------------------------------------------------------------------
# calcular_prazo_interno
# ---------------------------------------------------------------------------

def test_prazo_interno_2_dias_antes():
    prazo_cliente = datetime(2025, 6, 10, tzinfo=timezone.utc)
    interno = calcular_prazo_interno(prazo_cliente)
    assert interno == datetime(2025, 6, 8, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# modalidade_para_prazo
# ---------------------------------------------------------------------------

def _user_com_plano(code: str):
    plan = SimpleNamespace(code=code)
    return SimpleNamespace(active_plan=plan)


def _user_sem_plano():
    return SimpleNamespace(active_plan=None)


def test_plano_essencial():
    assert modalidade_para_prazo(_user_com_plano("plano_essencial")) == "essencial"


def test_plano_profissional():
    assert modalidade_para_prazo(_user_com_plano("plano_profissional")) == "profissional"


def test_plano_estrategico():
    assert modalidade_para_prazo(_user_com_plano("plano_estrategico")) == "estrategico"


def test_sem_plano_retorna_avulso():
    assert modalidade_para_prazo(_user_sem_plano()) == "avulso"


def test_plano_desconhecido_retorna_avulso():
    assert modalidade_para_prazo(_user_com_plano("plano_novo_futuro")) == "avulso"


def test_user_sem_atributo_active_plan_retorna_avulso():
    user = SimpleNamespace()  # sem active_plan
    assert modalidade_para_prazo(user) == "avulso"


def test_estrategico_prazo_menor_que_avulso():
    """Plano Premium tem prazo mais curto (2 dias úteis vs 3)."""
    inicio = datetime(2025, 6, 2, 12, 0, tzinfo=timezone.utc)
    prazo_avulso = calcular_prazo_entrega("avulso", inicio)
    prazo_estrategico = calcular_prazo_entrega("estrategico", inicio)
    assert prazo_estrategico < prazo_avulso
