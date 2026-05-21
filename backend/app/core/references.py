"""Gerador de referências humanas (`PET-000123`, `ORD-000045`) seguro
sob concorrência.

Por que isso existe
-------------------
Antes deste módulo, três serviços geravam referências assim::

    return f"PET-{Petition.query.count() + 1:06d}"

Sob concorrência (duas requisições paralelas do mesmo usuário, ou
threads do gunicorn atendendo o mesmo segundo), `count() + 1` colide:
N threads contam o mesmo total, todas geram a mesma string e o
``UNIQUE`` da coluna ``reference`` rejeita N-1 inserções com
``IntegrityError``. O smoke E2E (step 12) reproduziu isso facilmente.

O fluxo seguro precisa de um valor atômico. O próprio ``id`` da linha
(``SERIAL``/``AUTOINCREMENT``) já é atômico no banco, então a estratégia
é::

    1. Inserir com placeholder único (UUID hex) no campo `reference`
    2. flush() → ganhamos um `id` atômico
    3. Atualizar `reference` para o formato humano `PREFIX-NNNNNN`
    4. flush() de novo (mesma transação — caller controla o commit)

Funciona em SQLite (testes) e Postgres (produção) sem locks adicionais.
"""

from __future__ import annotations

import uuid


def temporary_reference(prefix: str) -> str:
    """Placeholder único pra preencher a coluna durante o INSERT inicial.

    O sufixo é um trecho de UUID4 — virtualmente impossível colidir
    mesmo com milhares de inserções concorrentes. O caller substitui
    pelo formato humano logo após o flush.
    """
    return f"{prefix}-TMP-{uuid.uuid4().hex[:16]}"


def human_reference(prefix: str, row_id: int) -> str:
    """Formato humano final: ``PREFIX-NNNNNN``.

    Como ``row_id`` vem do PK auto-incrementado (Postgres SERIAL ou
    SQLite ROWID), é garantidamente único dentro da tabela. Tabelas
    diferentes podem repetir números, mas como o prefixo difere
    (`PET-` ≠ `ORD-`) e cada tabela tem seu próprio UNIQUE, não há
    conflito real.
    """
    return f"{prefix}-{int(row_id):06d}"
