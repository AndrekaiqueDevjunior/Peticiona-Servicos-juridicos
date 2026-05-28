"""Ponto único de mutação do livro-razão de saldo (`credit_transactions`).

Por que isso existe
-------------------
Antes desta camada, escritas em ``credit_transactions`` aconteciam em
seis lugares diferentes (petition_service, client_area_service,
checkout_service, admin_service, credit_payment_service…). Cada um
duplicava a regra do `type/source/amount/description` e tratava
idempotência/concorrência à sua maneira (ou não tratava). O resultado
foi um conjunto de gambiarras: `_assert_sufficient_balance` divergia
de `get_balance` na interpretação de `type`, débitos repetidos em
cancelamento eram filtrados por `description LIKE %order_ref%`, e
nenhum dos caminhos pegava advisory lock — duas requisições paralelas
do mesmo usuário furavam o gate de saldo.

Este módulo encapsula:

* `compute_balance(user_id)` — soma autoritativa. **Únicos tipos
  aceitos: `'in'` e `'out'`.** Qualquer outro estoura `LedgerCorruption`.
* `credit(user, …)` — adiciona créditos (`type='in'`).
* `debit(user, …)` — subtrai créditos (`type='out'`) com checagem de
  saldo dentro do mesmo lock advisory.
* `refund(original_tx, …)` — estorna uma transação existente como
  espelho do `type` original (`out` vira `in` etc.).

Garantias
---------
1. **Advisory lock por usuário** (`pg_advisory_xact_lock(NS, user_id)`)
   é obtido no início de toda mutação. Serializa débitos/créditos
   concorrentes do mesmo usuário. Liberado automaticamente no commit
   ou rollback da transação. No SQLite (testes) é um no-op — SQLite já
   serializa escritas no nível do banco.
2. **Idempotência por `idempotency_key`.** Se a chave já existe para
   este usuário (consultada dentro do lock), o registro original é
   devolvido sem novo INSERT. Em concorrência cross-user (chaves
   colidirem por bug), o UNIQUE parcial no banco joga IntegrityError.
3. **Invariante de saldo não-negativo.** Pós-INSERT de `out`, o saldo é
   recomputado e a transação é abortada (raise) se ficou negativo —
   defesa em profundidade caso o gate falhe.
4. **Tipos restritos.** Tanto o gate em runtime (este arquivo) quanto a
   CHECK constraint no DDL recusam qualquer `type` fora de `{'in','out'}`.
5. **Operações não comitam.** Esta camada chama `db.session.flush()` mas
   nunca `commit()` — quem invoca controla a fronteira transacional.

Nenhuma outra parte do código deve fazer ``CreditTransaction(...)`` em
INSERT direto. Auditoria fica num único arquivo: se um PR introduz
escrita fora daqui, é red flag. Leituras (SELECT/JOIN) seguem livres.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import text

from app.core.extensions import db
from app.models import CreditTransaction

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

#: Namespace fixo do advisory lock — escolhido para não colidir com o lock
#: de boot em `bootstrap/migrations.py` (784231337). Caractere 'L','D','G','R'
#: codificado em int4. Qualquer valor cabendo em int4 serve, desde que único
#: dentro do app.
_LOCK_NAMESPACE = 0x4C44_4752  # "LDGR"

#: Tipos válidos em `credit_transactions.type`. Espelha a CHECK constraint
#: `ck_credit_transactions_type` no DDL.
_TYPE_IN = "in"
_TYPE_OUT = "out"
_VALID_TYPES = frozenset({_TYPE_IN, _TYPE_OUT})

#: Kinds válidos para créditos. Espelha CHECK constraint
#: `ck_credit_transactions_kind`. 'legacy_cents' é histórico; código novo
#: NUNCA escreve com esse kind — só leitura para extrato.
#: 'peticao_express' e 'recurso_express' existem no DB como dados legados
#: mas não são mais utilizados para novas escritas — Express virou upgrade pago.
KIND_COMMON = "common"
KIND_LEGACY_CENTS = "legacy_cents"
_VALID_KINDS = frozenset({KIND_COMMON})
_ACTIVE_KINDS = (KIND_COMMON,)

#: Mapa de label humano por kind — usado em mensagens de erro/UI.
KIND_LABELS = {
    KIND_COMMON: "créditos",
}


# ---------------------------------------------------------------------------
# Exceções
# ---------------------------------------------------------------------------


class LedgerError(Exception):
    """Base de erros do livro-razão. Callers podem traduzir para
    ``ValidationError`` antes de devolver ao cliente."""


class InsufficientBalance(LedgerError):
    """Tentativa de débito maior que o saldo disponível para o kind solicitado."""

    def __init__(self, *, available: int, required: int, kind: str = KIND_COMMON) -> None:
        super().__init__(
            f"insufficient balance (kind={kind}): available={available}, required={required}"
        )
        self.available = available
        self.required = required
        self.kind = kind


class LedgerCorruption(LedgerError):
    """Estado impossível detectado em runtime — não deveria acontecer se as
    CHECK constraints e este módulo forem a única porta de escrita."""


class IdempotentReplay(LedgerError):
    """Chave de idempotência reusada com payload incompatível.

    Acontece se um caller reutiliza uma `idempotency_key` que já existe
    no DB mas o `source`/`amount` divergem do registro original. É um
    bug do caller — não silenciamos."""


# ---------------------------------------------------------------------------
# Locking
# ---------------------------------------------------------------------------


def _acquire_advisory_lock(user_id: int) -> None:
    """Serializa mutações concorrentes para o mesmo usuário.

    Em Postgres usa `pg_advisory_xact_lock(ns, user_id)` — lock fica de
    pé até o commit/rollback da transação atual. Outras conexões que
    pedirem o mesmo par (ns, user_id) bloqueiam aqui.

    Em SQLite (testes) é no-op — escritas SQLite já são serializadas
    pelo próprio banco e o cenário de concorrência real não é
    reproduzível nesse backend.
    """
    if db.engine.dialect.name != "postgresql":
        return
    db.session.execute(
        text("SELECT pg_advisory_xact_lock(:ns, :uid)"),
        {"ns": _LOCK_NAMESPACE, "uid": int(user_id)},
    )


# ---------------------------------------------------------------------------
# Cálculo do saldo
# ---------------------------------------------------------------------------


def compute_balance(user_id: int, *, kind: str = KIND_COMMON) -> int:
    """Saldo (em unidades de crédito) do usuário para um `kind` específico.

    Ignora rows com `kind='legacy_cents'` — saldo histórico em centavos
    que NÃO entra mais na contagem. O sistema novo opera em unidades
    (1 crédito = 1 serviço).
    """
    if kind not in _VALID_KINDS:
        raise LedgerError(
            f"kind={kind!r} inválido — só {sorted(_VALID_KINDS)} são aceitos"
        )
    rows: Iterable[tuple[str, int]] = db.session.execute(
        text(
            "SELECT type, amount FROM credit_transactions "
            "WHERE user_id = :uid AND kind = :kind"
        ),
        {"uid": int(user_id), "kind": kind},
    ).fetchall()

    balance = 0
    for ttype, amount in rows:
        if ttype == _TYPE_IN:
            balance += int(amount)
        elif ttype == _TYPE_OUT:
            balance -= int(amount)
        else:
            raise LedgerCorruption(
                f"credit_transactions.type={ttype!r} fora do whitelist "
                f"(user_id={user_id})"
            )
    return balance


def compute_balances(user_id: int) -> dict[str, int]:
    """Retorna `{common}` para o usuário. Ignora 'legacy_cents'."""
    return {"common": compute_balance(user_id, kind=KIND_COMMON)}


def compute_totals(user_id: int, *, kind: str = KIND_COMMON) -> dict[str, int]:
    """Retorna `{credits_in, credits_out, balance}` para o kind solicitado.

    Mantém retro-compatibilidade com callers antigos que esperavam
    totais agregados — agora sempre referente a um kind específico.
    """
    if kind not in _VALID_KINDS:
        raise LedgerError(
            f"kind={kind!r} inválido — só {sorted(_VALID_KINDS)} são aceitos"
        )
    rows = db.session.execute(
        text(
            "SELECT type, amount FROM credit_transactions "
            "WHERE user_id = :uid AND kind = :kind"
        ),
        {"uid": int(user_id), "kind": kind},
    ).fetchall()

    credits_in = 0
    credits_out = 0
    for ttype, amount in rows:
        if ttype == _TYPE_IN:
            credits_in += int(amount)
        elif ttype == _TYPE_OUT:
            credits_out += int(amount)
        else:
            raise LedgerCorruption(
                f"credit_transactions.type={ttype!r} fora do whitelist "
                f"(user_id={user_id})"
            )
    return {
        "credits_in": credits_in,
        "credits_out": credits_out,
        "balance": credits_in - credits_out,
    }


# ---------------------------------------------------------------------------
# Operações de escrita
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _WriteParams:
    user_id: int
    ttype: str
    amount: int
    source: str
    description: str
    idempotency_key: str | None
    company_id: int | None
    kind: str = KIND_COMMON
    #: Se True, pula o gate de saldo suficiente e a invariante final de
    #: não-negatividade. Usado em estornos de gateway externo (Pagar.me
    #: reembolsou — não há como o cliente "ter saldo" para perder o
    #: crédito antes consumido) e em reversões administrativas explícitas.
    allow_negative_balance: bool = False


def _validate(params: _WriteParams) -> None:
    if params.ttype not in _VALID_TYPES:
        raise LedgerError(
            f"type={params.ttype!r} inválido — só {sorted(_VALID_TYPES)} são aceitos"
        )
    if params.kind not in _VALID_KINDS:
        raise LedgerError(
            f"kind={params.kind!r} inválido — só {sorted(_VALID_KINDS)} são aceitos"
        )
    if not isinstance(params.amount, int) or params.amount <= 0:
        raise LedgerError(
            f"amount deve ser inteiro > 0, recebido {params.amount!r}"
        )
    if not params.description or not params.description.strip():
        raise LedgerError("description é obrigatório (preenche o livro-razão)")
    if len(params.description) > 255:
        raise LedgerError("description não pode passar de 255 caracteres")
    if params.source is not None and len(params.source) > 20:
        raise LedgerError("source não pode passar de 20 caracteres")
    if params.idempotency_key is not None and len(params.idempotency_key) > 128:
        raise LedgerError("idempotency_key não pode passar de 128 caracteres")


def _find_by_idempotency_key(
    user_id: int, idempotency_key: str
) -> CreditTransaction | None:
    return (
        CreditTransaction.query
        .filter(CreditTransaction.idempotency_key == idempotency_key)
        .filter(CreditTransaction.user_id == user_id)
        .first()
    )


def _ensure_idempotent_match(
    existing: CreditTransaction, params: _WriteParams
) -> None:
    """Confere que o registro encontrado bate com o que o caller pediu.

    Se a chave de idempotência é a mesma mas o payload diverge, é bug
    do caller — nunca deveria mandar (key, amount=100) e depois
    (key, amount=200). Estoura ao invés de mascarar.
    """
    mismatches: list[str] = []
    if existing.type != params.ttype:
        mismatches.append(f"type {existing.type!r} ≠ {params.ttype!r}")
    if existing.amount != params.amount:
        mismatches.append(f"amount {existing.amount} ≠ {params.amount}")
    if existing.source != params.source:
        mismatches.append(f"source {existing.source!r} ≠ {params.source!r}")
    existing_kind = getattr(existing, "kind", None) or KIND_COMMON
    if existing_kind != params.kind:
        mismatches.append(f"kind {existing_kind!r} ≠ {params.kind!r}")
    if mismatches:
        raise IdempotentReplay(
            f"idempotency_key={params.idempotency_key!r} já existe com "
            f"payload divergente: {'; '.join(mismatches)}"
        )


def _insert(params: _WriteParams) -> CreditTransaction:
    """Insere uma transação após validar + lock + idempotência + invariante.

    Não comita. Caller controla a fronteira transacional.
    """
    _validate(params)
    _acquire_advisory_lock(params.user_id)

    if params.idempotency_key:
        existing = _find_by_idempotency_key(params.user_id, params.idempotency_key)
        if existing is not None:
            _ensure_idempotent_match(existing, params)
            return existing

    if params.ttype == _TYPE_OUT and not params.allow_negative_balance:
        # Gate de saldo DENTRO do lock — única forma segura de garantir
        # que dois débitos concorrentes não somem além do disponível.
        current = compute_balance(params.user_id, kind=params.kind)
        if current < params.amount:
            raise InsufficientBalance(
                available=current, required=params.amount, kind=params.kind,
            )

    tx = CreditTransaction(
        user_id=params.user_id,
        company_id=params.company_id,
        type=params.ttype,
        source=params.source,
        amount=params.amount,
        description=params.description,
        idempotency_key=params.idempotency_key,
        kind=params.kind,
    )
    db.session.add(tx)
    db.session.flush()

    # Defesa em profundidade: se algum bug nosso (ou um INSERT cru de
    # outro lugar fora deste módulo) deixou o saldo negativo, fail-fast
    # antes de continuar. Não substitui o gate acima — complementa.
    if not params.allow_negative_balance:
        final = compute_balance(params.user_id, kind=params.kind)
        if final < 0:
            raise LedgerCorruption(
                f"saldo ficou negativo após INSERT (user_id={params.user_id}, "
                f"kind={params.kind}, balance={final}) — invariante violada"
            )
    return tx


def credit(
    user,
    *,
    amount: int,
    source: str,
    description: str,
    idempotency_key: str | None = None,
    company_id: int | None = None,
    kind: str = KIND_COMMON,
) -> CreditTransaction:
    """Adiciona créditos UNITÁRIOS ao saldo do usuário (`type='in'`).

    Args:
        amount: quantidade de créditos (unidades, não centavos).
        kind: tipo do crédito ('common' default — único suportado atualmente).
    """
    params = _WriteParams(
        user_id=user.id,
        ttype=_TYPE_IN,
        amount=int(amount),
        source=source,
        description=description,
        idempotency_key=idempotency_key,
        company_id=company_id if company_id is not None else getattr(user, "company_id", None),
        kind=kind,
    )
    return _insert(params)


def debit(
    user,
    *,
    amount: int,
    source: str,
    description: str,
    idempotency_key: str | None = None,
    company_id: int | None = None,
    allow_negative_balance: bool = False,
    kind: str = KIND_COMMON,
) -> CreditTransaction:
    """Subtrai créditos UNITÁRIOS do saldo (`type='out'`).

    Args:
        amount: quantidade de créditos a debitar.
        kind: tipo do crédito ('common' default — único suportado atualmente).
    """
    params = _WriteParams(
        user_id=user.id,
        ttype=_TYPE_OUT,
        amount=int(amount),
        source=source,
        description=description,
        idempotency_key=idempotency_key,
        company_id=company_id if company_id is not None else getattr(user, "company_id", None),
        allow_negative_balance=allow_negative_balance,
        kind=kind,
    )
    return _insert(params)


def refund(
    original: CreditTransaction,
    *,
    source: str,
    description: str,
    idempotency_key: str | None = None,
    allow_negative_balance: bool = True,
) -> CreditTransaction:
    """Estorna uma transação existente como espelho.

    `out` vira `in` (devolve crédito ao usuário) e vice-versa.
    Sempre estorna no MESMO `kind` da transação original.
    """
    if original.type == _TYPE_OUT:
        reverse_type = _TYPE_IN
    elif original.type == _TYPE_IN:
        reverse_type = _TYPE_OUT
    else:
        raise LedgerCorruption(
            f"transação a estornar tem type={original.type!r} inválido"
        )

    original_kind = getattr(original, "kind", None) or KIND_COMMON
    if original_kind == KIND_LEGACY_CENTS:
        raise LedgerError(
            "não é possível estornar transação legacy_cents — saldo histórico "
            "não participa do novo sistema de créditos"
        )

    params = _WriteParams(
        user_id=original.user_id,
        ttype=reverse_type,
        amount=int(original.amount),
        source=source,
        description=description,
        idempotency_key=idempotency_key,
        company_id=original.company_id,
        allow_negative_balance=allow_negative_balance,
        kind=original_kind,
    )
    return _insert(params)
