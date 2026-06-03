# JWT Auth & Role Access-Scope Validator

## Objetivo

Garantir autenticação (JWT HS256) e autorização corretas no Peticiona: validar **role**
(`admin`/`staff`/`client`) **e escopo de dados** (`scoped_query`) no backend, prevenindo
**broken access control** e **privilege escalation**. Workspace é **único** (não multi-tenant).

## Quando usar

- Ao criar/alterar endpoint que exige login.
- Ao mexer em login, cadastro, reset de senha, emissão/validação de token.
- Ao definir quem pode ver/alterar quais registros.
- Ao revisar exposição de dados entre usuários/roles.

## Quando não usar

- Para integração de pagamento em si (use `credit-ledger-payments`).
- Para headers/CORS/upload (use `security-audit`).

## Responsabilidades

- Validar emissão/decodificação de JWT (`core/jwt.py`): assinatura, expiração, `sub`.
- Garantir autorização por **role** e por **escopo** (`domain/permissions.py: scoped_query`).
- Confirmar que `client` só acessa os próprios registros (`user_id`); `admin`/`staff` acessam tudo.
- Verificar hash/força de senha e rate limit em auth.
- Impedir que decisões de acesso fiquem só no frontend.

## Checklist operacional

**Antes**
- [ ] Quais roles podem acessar? Qual o escopo de dados (próprio vs todos)?
- [ ] A rota lê o usuário autenticado a partir do token, não do payload do cliente?

**Durante**
- [ ] Token validado (assinatura + expiração); `sub` → `user_id` via `extract_subject`.
- [ ] Autorização por role aplicada **no backend** (não só na UI).
- [ ] Consultas usam `scoped_query(model, actor)` ou filtro por `user_id` para `client`.
- [ ] IDs vindos do cliente nunca confiados sem checar ownership/role.
- [ ] Senha com hash werkzeug + salt; reset com token de TTL.

**Depois**
- [ ] Teste de acesso negado (client tentando recurso de outro / de admin).
- [ ] Auditoria em mudança de role/perfil e reset de senha.

## Entradas esperadas

- O recurso, os roles permitidos e a regra de escopo (próprio vs global).

## Saídas esperadas

- Endpoint com authn + authz corretos e testes de acesso negado.
- Relatório de qualquer brecha de IDOR/escalonamento encontrada.

## Arquivos comuns para revisar

- `backend/app/core/jwt.py`, `backend/app/core/password.py`, `backend/app/core/rate_limit.py`
- `backend/app/domain/permissions.py`, `backend/app/permissions/`
- `backend/app/modules/{auth,me,admin,staff}/routes.py`
- `backend/app/services/{auth_service,user_service,password_reset_service}.py`
- `frontend/src/lib/{api,roles}.ts`

## Boas práticas

- Identidade vem **sempre** do token, nunca de campo enviado pelo cliente.
- Negar por padrão; liberar explicitamente por role/escopo.
- Checar ownership de todo recurso acessado por `id`.
- Mensagens de erro genéricas em auth (não revelar se e-mail existe).

## Erros comuns

- Confiar no `user_id` enviado no body em vez do token.
- IDOR: `GET /orders/<id>` sem checar se pertence ao `client`.
- Autorizar só no frontend (esconder botão) sem checar no backend.
- Reintroduzir filtro por `company_id` achando que é multi-tenant (não é).
- Logar token/senha.

## Regras obrigatórias

- Autenticação **e** autorização validadas no **backend**, sempre.
- `client` nunca acessa dado de outro usuário; `admin`/`staff` conforme política.
- Identidade derivada do JWT validado.
- Nunca confiar no frontend como barreira de segurança.

## Exemplo de prompt usando esta Skill

> "Use a skill `auth-rbac`: audite todos os endpoints de `client_area` e `me` e me diga onde
> um `client` consegue acessar/alterar dados de outro usuário (IDOR) ou recursos de admin.
> Proponha a correção usando `scoped_query` e testes de acesso negado."
