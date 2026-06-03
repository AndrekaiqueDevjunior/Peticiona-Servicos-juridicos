# Pytest + Vitest Testing & Quality

## Objetivo

Garantir cobertura de teste real no Peticiona: pytest no backend (services, rotas, ledger,
auth, webhooks) e Vitest no frontend (hooks/componentes com lógica), priorizando fluxos
críticos financeiros e de acesso — sem testar mock como se fosse comportamento real.

## Quando usar

- Ao implementar/alterar feature ou corrigir bug (teste de regressão).
- Ao tocar fluxo crítico: saldo, pagamento, split, auth, escopo, upload, webhook.
- Em revisão de PR para checar cobertura dos caminhos de erro.

## Quando não usar

- Como substituto de verificação real ponta a ponta (mock não prova integração).
- Para definir a regra de negócio (use `backend-api`).

## Responsabilidades

- Escrever testes de sucesso **e** de falha (validação, acesso negado, saldo insuficiente).
- Cobrir invariantes do ledger (idempotência, lock, saldo não-negativo, tipos `in`/`out`).
- Cobrir authz (client não acessa dado de outro; role errado é barrado).
- Cobrir webhooks (assinatura inválida rejeitada; reentrega não duplica efeito).
- Manter fixtures/seeds isolados; rodar lint/build.

## Checklist operacional

**Antes**
- [ ] Quais caminhos críticos e de erro precisam de teste?
- [ ] Há fixtures adequados (sem depender de dado de produção)?

**Durante**
- [ ] Testar caminho feliz + erros (400/401/403/409) + bordas.
- [ ] Ledger: idempotência, concorrência, saldo insuficiente, reembolso.
- [ ] Auth: token inválido/expirado, role insuficiente, IDOR.
- [ ] Frontend: estados loading/erro/vazio; mutação invalida cache.

**Depois**
- [ ] `pytest` (backend) e `npm test`/`vitest run` (frontend) passam.
- [ ] `eslint`/lint e build OK; sem teste que valida só mock.

## Entradas esperadas

- A feature/bug, os caminhos críticos e os contratos de API.

## Saídas esperadas

- Testes pytest/Vitest cobrindo sucesso e falha, passando.
- Relatório dos caminhos cobertos e lacunas restantes.

## Arquivos comuns para revisar

- `backend/tests/**`, `backend/app/services/*.py`, `backend/app/modules/**`
- `frontend/src/test/**`, `frontend/src/hooks/**`, `frontend/vitest.config.ts`
- `package.json` (scripts `test`), `backend` (config pytest)

## Boas práticas

- Priorizar testes onde o risco/dinheiro está.
- Um comportamento por teste; nomes que descrevem o cenário.
- Fixtures determinísticos; nada de rede real em teste (sandbox/stub claro do provider).
- Teste de regressão para todo bug corrigido.

## Erros comuns

- Testar só o caminho feliz.
- Mockar o provider e concluir que "a integração funciona".
- Teste acoplado a dado de produção.
- Não cobrir acesso negado/escopo.

## Regras obrigatórias

- Todo bug corrigido ganha teste de regressão.
- Fluxos financeiros e de acesso têm testes de falha, não só sucesso.
- Suites pytest e Vitest devem passar antes do "done".
- Mock em teste nunca é evidência de integração real (ver `anti-mock-audit`).

## Exemplo de prompt usando esta Skill

> "Use a skill `testing-quality`: escreva os testes pytest do `credit_ledger` cobrindo débito
> com saldo insuficiente, idempotência por `idempotency_key`, reembolso e a invariante de saldo
> não-negativo. Inclua um teste de duas chamadas concorrentes do mesmo usuário."
