# Flask Module & Service Reviewer

## Objetivo

Criar e revisar endpoints Flask do Peticiona seguindo o padrão `routes.py → schemas.py →
services/*.py → models/*.py`, com validação, autorização e serialização corretas.

## Quando usar

- Ao criar/alterar um endpoint em `modules/<dominio>/routes.py`.
- Ao escrever/revisar um service em `app/services/`.
- Ao definir o contrato de request/response de uma rota.
- Em revisão de PR de backend.

## Quando não usar

- Para regras de saldo/crédito/pagamento (use `credit-ledger-payments`).
- Para auth/JWT/roles em profundidade (use `auth-rbac`).
- Para modelagem de banco (use `database-modeling`).

## Responsabilidades

- Garantir separação: HTTP em `routes.py`, validação em `schemas.py`, regra em `services/`.
- Validar autenticação + autorização (role + `scoped_query`) na rota.
- Padronizar erros via `core/errors.py` (`ValidationError`, `AuthError`).
- Serializar respostas via `services/serializers.py` (sem vazar campos sensíveis).
- Garantir códigos HTTP corretos e mensagens PT-BR seguras.

## Checklist operacional

**Antes**
- [ ] Existe módulo de domínio para essa rota? Senão, criar `modules/<dominio>/`.
- [ ] O service necessário existe ou precisa ser criado?

**Durante**
- [ ] Payload validado por schema (tipos, obrigatórios, saneamento).
- [ ] Autenticação verificada; autorização por role + escopo de dados.
- [ ] Regra de negócio no service; route só orquestra.
- [ ] Sem SQL/`db.session.commit` na route.
- [ ] Erros tratados com exceções de domínio; sem stack trace ao cliente.
- [ ] Resposta serializada (sem `password_hash`, segredos, dados de outro usuário).

**Depois**
- [ ] Teste pytest cobrindo sucesso, erro de validação e acesso negado.
- [ ] Auditoria registrada se a ação for crítica.

## Entradas esperadas

- Domínio/objetivo do endpoint, método HTTP e contrato desejado.
- Quais roles podem acessar e qual o escopo de dados.

## Saídas esperadas

- Route + schema + (service novo/alterado) coesos.
- Contrato de request/response documentado.
- Testes do endpoint.

## Arquivos comuns para revisar

- `backend/app/modules/<dominio>/{routes,schemas}.py`
- `backend/app/services/*.py`, `backend/app/services/serializers.py`
- `backend/app/core/{errors,jwt,rate_limit}.py`
- `backend/app/domain/permissions.py`
- `backend/tests/*`

## Boas práticas

- Schemas explícitos; nunca confiar no payload cru.
- Funções de service pequenas e testáveis; sem dependência do objeto `request`.
- Reusar `scoped_query(model, actor)` para visibilidade.
- Idempotência em operações sensíveis (ex.: usar `idempotency_key` quando mexe em saldo).

## Erros comuns

- Regra de negócio na route.
- Esquecer autorização (só autenticar não basta).
- Retornar o model inteiro (vaza campos).
- Capturar exceção genérica e devolver 200.
- Commit de transação espalhado/sem controle.

## Regras obrigatórias

- Toda rota autenticada valida **role + escopo** no backend.
- Validação de entrada via schema **sempre**.
- Sem regra de negócio nem SQL em `routes.py`.
- Resposta passa por serializer; nada de campo sensível vazado.

## Exemplo de prompt usando esta Skill

> "Use a skill `backend-api`: crie o endpoint `POST /api/orders/<id>/reopen` no módulo
> `petitions`. Só `admin` e `staff` podem chamar; valide o estado atual do pedido no service,
> registre auditoria e devolva o pedido serializado. Inclua os testes pytest."
