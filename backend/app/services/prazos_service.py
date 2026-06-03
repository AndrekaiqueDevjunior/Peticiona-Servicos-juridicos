"""Serviço de cálculo de prazos de entrega com dias úteis."""

from datetime import datetime, timedelta, timezone
from typing import Literal

# Feriados nacionais brasileiros (datas fixas)
_FERIADOS_FIXOS = [
    (1, 1),      # Confraternização Universal
    (4, 21),     # Tiradentes
    (5, 1),      # Dia do Trabalho
    (9, 7),      # Independência
    (10, 12),    # N. Sra. Aparecida
    (11, 2),     # Finados
    (11, 15),    # Proclamação da República
    (11, 20),    # Consciência Negra
    (12, 25),    # Natal
]


def _calcular_pascoa(ano: int) -> datetime:
    """Calcula o Domingo de Páscoa usando o algoritmo de Meeus/Jones/Butcher."""
    a = ano % 19
    b = ano // 100
    c = ano % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = ((h + l - 7 * m + 114) % 31) + 1
    return datetime(ano, mes, dia, tzinfo=timezone.utc)


def _get_feriados_moveis(ano: int) -> list[tuple[int, int]]:
    """Retorna feriados móveis (Páscoa e derivados) do ano."""
    pascoa = _calcular_pascoa(ano)
    carnaval_seg = pascoa - timedelta(days=48)
    carnaval_ter = pascoa - timedelta(days=47)
    sexta_santa = pascoa - timedelta(days=2)
    corpus_christi = pascoa + timedelta(days=60)

    return [
        (carnaval_seg.month, carnaval_seg.day),
        (carnaval_ter.month, carnaval_ter.day),
        (sexta_santa.month, sexta_santa.day),
        (corpus_christi.month, corpus_christi.day),
    ]


_cache_feriados: dict[int, set[tuple[int, int]]] = {}


def _get_feriados_ano(ano: int) -> set[tuple[int, int]]:
    """Retorna todos os feriados (fixos + móveis) de um ano."""
    if ano not in _cache_feriados:
        feriados = set(_FERIADOS_FIXOS)
        feriados.update(_get_feriados_moveis(ano))
        _cache_feriados[ano] = feriados
    return _cache_feriados[ano]


def _is_dia_util(data: datetime) -> bool:
    """Verifica se uma data é dia útil (seg-sex, sem feriados)."""
    dow = data.weekday()  # 0=seg, 6=dom
    if dow >= 5:  # sábado ou domingo
        return False
    feriados = _get_feriados_ano(data.year)
    return (data.month, data.day) not in feriados


def calcular_prazo_entrega(
    modalidade: Literal["essencial", "profissional", "estrategico", "avulso"],
    inicio: datetime,
) -> datetime:
    """
    Calcula o prazo de entrega ao cliente (deadline_at).

    Adiciona dias úteis (seg-sex, sem feriados nacionais) conforme a modalidade.
    - Essencial: 3 dias úteis
    - Profissional: 3 dias úteis
    - Estratégico: 2 dias úteis
    - Avulso: 3 dias úteis

    Args:
        modalidade: tipo de serviço
        inicio: datetime da confirmação do pagamento (em UTC)

    Returns:
        datetime do prazo de entrega ao cliente
    """
    dias_uteis_map = {
        "essencial": 3,
        "profissional": 3,
        "estrategico": 2,
        "avulso": 3,
    }
    dias = dias_uteis_map.get(modalidade, 3)

    data = inicio
    restantes = dias
    while restantes > 0:
        data = data + timedelta(days=1)
        if _is_dia_util(data):
            restantes -= 1

    return data


def calcular_prazo_interno(prazo_cliente: datetime) -> datetime:
    """
    Calcula o prazo interno (funcionário).

    O prazo interno é sempre 2 dias corridos antes do prazo do cliente.
    """
    return prazo_cliente - timedelta(days=2)


_PLAN_CODE_TO_MODALIDADE: dict[str, str] = {
    "plano_essencial": "essencial",
    "plano_profissional": "profissional",
    "plano_estrategico": "estrategico",
}


def modalidade_para_prazo(user) -> str:
    """Retorna a modalidade de prazo conforme o plano ativo do usuário.

    Sem plano ou plano desconhecido → 'avulso' (3 dias úteis).
    """
    plan = getattr(user, "active_plan", None)
    if plan is None:
        return "avulso"
    return _PLAN_CODE_TO_MODALIDADE.get(getattr(plan, "code", ""), "avulso")
