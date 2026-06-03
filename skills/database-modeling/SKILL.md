# PostgreSQL / SQLAlchemy Schema & Migration Reviewer

## Objetivo

Modelar e revisar tabelas, relacionamentos, índices e migrações do Peticiona em SQLAlchemy +
PostgreSQL 16, preservando integridade financeira (centavos), auditoria e compatibilidade com
o boot (`db.create_all()` + `bootstrap/migrations.py`).

## Quando usar

- Ao criar/alterar um model em `backend/app/models/`.
- Ao adicionar coluna, índice, FK ou constraint.
- Ao escrever migração em `migrations/` ou `bootstrap/migrations.py`.
- Ao revisar performance de query (índices ausentes, N+1).

## Quando não usar

- Para regra de negócio sobre os dados (use `backend-api` / `credit-ledger-payments`).
- Para segurança de acesso aos dados (use `auth-rbac`).

## Responsabilidades

- Garantir tipos corretos: **dinheiro em inteiro (centavos)**, datas em UTC, `bool`/enum coerentes.
- Definir FKs, `nullable`, `unique` e índices em colunas de filtro/join/busca.
- Manter migração **idempotente** e compatível com o boot.
- Preservar invariantes (ex.: `credit_transactions.type ∈ {'in','out'}`, unique parcial de idempotência).
- Avaliar impacto em SQLite (testes) vs PostgreSQL (prod).

## Checklist operacional

**Antes**
- [ ] Entendi o agregado de domínio e onde o model deve ficar.
- [ ] Verifiquei se já existe model/coluna equivalente.

**Durante**
- [ ] Tipos corretos; valores financeiros em centavos (`Integer`), nunca `Float`.
- [ ] FKs e `ondelete` coerentes; `nullable`/`default` definidos.
- [ ] Índices nas colunas usadas em `WHERE`/`JOIN`/`ORDER BY`.
- [ ] Constraints de integridade (unique, check) onde a regra exige.
- [ ] Migração idempotente; não quebra `db.create_all()` nem o seed.

**Depois**
- [ ] Testado em SQLite (suite) e validado contra PostgreSQL.
- [ ] Sem N+1 introduzido; usar `joinedload`/`selectinload` quando necessário.

## Entradas esperadas

- O dado a persistir, relações com outros agregados e padrões de consulta.

## Saídas esperadas

- Model + migração idempotente + índices adequados.
- Notas sobre impacto de performance e compatibilidade.

## Arquivos comuns para revisar

- `backend/app/models/{users,orders,credits,plans,payments,financial,documents,audit}.py`
- `backend/app/bootstrap/{migrations,seed}.py`, `migrations/`
- `backend/app/core/extensions.py`, `infra/postgres/`

## Boas práticas

- Centavos para dinheiro; nunca arredondar com `float`.
- Índice em `user_id`, `status`, `created_at` e chaves de busca frequentes.
- Migração que pode rodar 2x sem efeito colateral.
- Preferir `selectinload` para coleções; evitar carregar tudo.

## Erros comuns

- `Float` para valor monetário (erro de arredondamento financeiro).
- Esquecer índice → query lenta em produção.
- Migração que assume estado e quebra em base nova/limpa.
- Reintroduzir filtro por `company_id` sem decisão (ver `AGENTS.md` §8).
- Datas naive (sem timezone).

## Regras obrigatórias

- Dinheiro em **inteiro (centavos)**, sempre.
- Migrações **idempotentes** e compatíveis com o boot.
- Não quebrar invariantes do `credit_ledger` no nível do schema.
- Sem alteração destrutiva de schema sem migração e revisão.

## Exemplo de prompt usando esta Skill

> "Use a skill `database-modeling`: preciso adicionar `delivered_at` e `reopened_count` na
> tabela de pedidos. Defina os tipos, índices necessários e escreva a migração idempotente
> em `bootstrap/migrations.py` sem quebrar o seed nem o SQLite de teste."
