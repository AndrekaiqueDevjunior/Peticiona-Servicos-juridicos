# React + React Query API Integration Auditor

## Objetivo

Garantir que as telas do Peticiona consumam a **API real** (Flask) corretamente, com TanStack
Query, formulários `react-hook-form + zod`, e **sem regra de negócio, mock ou cálculo de
valores oficiais no frontend**.

## Quando usar

- Ao conectar uma tela/feature a um endpoint.
- Ao revisar fluxos de criar/editar/excluir (CRUD) no frontend.
- Ao tratar loading/erro/sucesso de chamadas de API.
- Quando suspeitar de "CRUD visual" (botão que não chama API real).

## Quando não usar

- Para definir a regra de negócio em si (vai no backend — use `backend-api`).
- Para auditoria de mock/fake mais ampla (use `anti-mock-audit`).
- Para autorização de fato (backend — use `auth-rbac`); no frontend só ocultamos UI.

## Responsabilidades

- Confirmar que toda leitura/escrita passa por `frontend/src/lib/*.ts` chamando a API real.
- Garantir uso de TanStack Query (cache/invalidation) em vez de estado manual frágil.
- Validar formulários com zod, exibindo erros do backend.
- Garantir tratamento de loading, erro e estados vazios.
- Confirmar que preço/saldo/total exibidos vêm do backend (frontend só formata).

## Checklist operacional

**Antes**
- [ ] O endpoint existe e seu contrato está em `lib/api.ts`?
- [ ] A tela é de `admin`, `client` ou `staff`? UI condicionada ao role.

**Durante**
- [ ] Chamada isolada em `lib/<dominio>.ts`, não `fetch` solto na página.
- [ ] `useQuery`/`useMutation` com `queryKey` e `invalidateQueries` após mutação.
- [ ] Erro do backend exibido ao usuário (toast/sonner), sem engolir.
- [ ] Nenhum cálculo de valor oficial no componente (usar resposta da API).
- [ ] `localStorage` só para token/preferência, nunca como banco.

**Depois**
- [ ] Botões de salvar/editar/excluir realmente chamam a API e refletem o resultado.
- [ ] Teste Vitest do componente/hook quando houver lógica de UI relevante.

## Entradas esperadas

- A tela/fluxo e o(s) endpoint(s) correspondentes.
- O contrato de request/response e o role permitido.

## Saídas esperadas

- Integração funcional com a API real, com cache e tratamento de erro.
- Tipos alinhados ao backend; sem números inventados na UI.

## Arquivos comuns para revisar

- `frontend/src/lib/{api,checkoutApi,pedidos,balance,pricing,notifications}.ts`
- `frontend/src/pages/{admin,client,staff}/**`
- `frontend/src/components/**`, `frontend/src/hooks/**`

## Boas práticas

- `queryKey` consistente por recurso; invalidar após mutações.
- Tipar resposta da API; tratar `null`/estados vazios.
- Otimista só quando o backend confirma; reverter em erro.
- Máscaras (`lib/masks.ts`) para exibição; valor real vem da API.

## Erros comuns

- "CRUD visual": botão que altera estado local sem chamar API.
- Calcular total/saldo no React em vez de usar o backend.
- Usar `localStorage` como fonte de verdade de dados de negócio.
- Não invalidar cache → tela mostra dado velho.
- Esconder o erro do backend e fingir sucesso.

## Regras obrigatórias

- Todo dado de negócio vem da API real; nada de mock em produção.
- Valor oficial (preço/saldo/total) é do backend; frontend só formata.
- Frontend não é barreira de segurança; ele apenas oculta UI.

## Exemplo de prompt usando esta Skill

> "Use a skill `frontend-integration`: na página `client/Orders.tsx`, o botão 'Cancelar pedido'
> precisa chamar o endpoint real de cancelamento, invalidar a query de pedidos e o saldo, e
> mostrar o erro do backend se houver. Revise se hoje ele está fazendo só mudança visual."
