# Anti-Mock / Real-Flow Enforcer

## Objetivo

Eliminar e impedir mock data, fake data, CRUD apenas visual e integrações simuladas no código
de produção do Peticiona, garantindo que toda funcionalidade siga o **fluxo real**
`Frontend → API → Service → Banco` (+ provider externo quando houver).

## Quando usar

- Ao revisar uma feature "pronta" para confirmar que está conectada de verdade.
- Quando algo "funciona na tela" mas há dúvida se persiste no banco.
- Em auditoria de código procurando dados/serviços/integrações falsos.
- Antes de declarar uma tarefa concluída.

## Quando não usar

- Em arquivos de teste, seeds, fixtures e Storybook (lá dado simulado é permitido).
- Para definir a integração real em si (use `backend-api`/`external-integrations`).

## Responsabilidades

- Caçar e remover: mock/fake data, arrays simulando banco, JSON local como API, IDs/datas fixas,
  dashboards/relatórios com números inventados, usuário/role/permissão fake.
- Detectar **CRUD visual**: botões de salvar/editar/excluir que não chamam API real.
- Detectar `localStorage`/`sessionStorage` usados como **banco/fonte de verdade**.
- Detectar integração externa simulada (Pagar.me/Resend/Nemotron) tratada como real.
- Confirmar fluxo real ponta a ponta e persistência efetiva.

## Checklist operacional

**Antes**
- [ ] Listar telas/endpoints alegadamente prontos a verificar.

**Durante**
- [ ] Buscar mocks: `grep` por `mock`, `fake`, `dummy`, `TODO`, arrays literais grandes, `Math.random` em dado de negócio.
- [ ] Buscar `localStorage`/`sessionStorage` guardando dado de negócio (saldo, pedidos, permissões).
- [ ] Conferir que cada botão de mutação chama `lib/*.ts` → API real → service → banco.
- [ ] Conferir que dashboard/relatório usa dados retornados pela API.
- [ ] Conferir que provider externo é chamado de fato (não stub simulando sucesso).

**Depois**
- [ ] Provar persistência: criar via UI → consultar no banco/endpoint → existe.
- [ ] Garantir que dados simulados restantes estão só em seed/fixture/teste/Storybook/sandbox.

## Entradas esperadas

- As features/telas a verificar e o que deveria estar persistindo.

## Saídas esperadas

- Lista de violações (arquivo + linha) e plano de correção para fluxo real.
- Confirmação de persistência efetiva quando OK.

## Arquivos comuns para revisar

- `frontend/src/pages/**`, `frontend/src/components/**`, `frontend/src/lib/*.ts`
- `backend/app/services/*.py`, `backend/app/modules/**`
- (Permitidos) `backend/app/bootstrap/seed.py`, `backend/tests/**`, `frontend/src/test/**`

## Boas práticas

- "Funciona" = persiste no banco e sobrevive a um reload/refetch.
- Dado de teste sempre claramente isolado (seed/fixture/sandbox).
- Se não há endpoint, a feature não está pronta — criar no backend primeiro.

## Erros comuns

- Declarar "feito" com estado só em memória/`localStorage`.
- Tabela/dashboard populada por array hardcoded.
- Integração "ok" com provider retornando sucesso simulado.
- Seed de produção com usuário/admin fake.
- IDs/datas fixas vazando para produção.

## Regras obrigatórias

- **Proibido** mock/fake/CRUD-visual/integração-simulada em código de produção.
- Dado simulado só em seed/fixture/teste/Storybook/sandbox identificado.
- Nunca afirmar que algo funciona sem fluxo real até o banco/provider.

## Exemplo de prompt usando esta Skill

> "Use a skill `anti-mock-audit`: varra `frontend/src` e `backend/app` e liste tudo que é mock,
> fake, CRUD visual ou `localStorage` usado como banco. Para cada item, diga o arquivo, a linha
> e o que precisa para virar fluxo real (endpoint/service/persistência)."
