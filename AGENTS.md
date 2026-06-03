# AGENTS.md — Regras Globais do Projeto Peticiona

> Este arquivo é a **fonte de verdade** para qualquer agente de IA (Claude Code, Cursor,
> Windsurf, Codex etc.) que atue neste repositório. Ele descreve o projeto **como ele
> realmente é hoje**, não como documentação antiga o descreve.
>
> Em caso de conflito entre este arquivo e `README.md`/`docs/architecture.md`,
> **este arquivo vence** e a documentação desatualizada deve ser corrigida
> (ver `skills/documentation-architect`).

---

## 1. Visão geral do projeto

- **Nome:** Peticiona — Serviços Jurídicos
- **Tipo:** SaaS jurídico (B2B/B2C) para solicitação, produção e entrega de **petições e
  serviços jurídicos**, com **sistema de créditos**, **planos**, **checkout/pagamento**,
  **split payment**, **upload de documentos** e **área administrativa/operacional**.
- **Perfis de usuário (roles):** `admin`, `staff`, `client`.
  - `admin`: gestão total (clientes, pedidos, financeiro, planos, staff).
  - `staff`: operação de pedidos (atendimento/produção das petições).
  - `client`: advogado/cliente final que compra créditos e solicita petições.
- **Princípios inegociáveis:**
  1. **OWASP em primeiro lugar** — validação, autorização e regra de negócio no backend.
  2. **Backend-first** — cálculos, valores oficiais, dashboard, split e upload são do backend.
  3. **Frontend só exibe** — coleta entrada, chama a API e renderiza a resposta. Nunca decide.

---

## 2. Stack oficial (real)

### Frontend (app canônico: `frontend/`)
- **Vite 5** + **React 18** + **TypeScript 5**
- **React Router DOM 6** (NÃO é Next.js — a documentação antiga está errada)
- **shadcn/ui** + **Radix UI** + **TailwindCSS 3**
- **TanStack Query (react-query 5)** para estado de servidor
- **react-hook-form** + **zod** para formulários
- **Vitest** + **Testing Library** para testes

> ⚠️ A pasta **raiz** do repositório contém um scaffold Vite legado (`package.json` =
> `vite_react_shadcn_ts`, sem `src/`). **Ele não é o frontend.** O frontend canônico é
> `frontend/`. Não criar features na raiz.

### Backend (`backend/`)
- **Flask 3** + **SQLAlchemy** + **PyJWT (HS256)** + **werkzeug.security**
- **PostgreSQL 16** em produção; **SQLite** apenas como fallback local de dev/teste
- **pytest** para testes

### Infra
- **Docker Compose** (frontend, backend, postgres) + **nginx**

### Integrações externas
- **Pagar.me** — pagamentos e **split payment** (`services/pagarme_service.py`, módulo `split_payment`, `webhooks`)
- **Resend** — e-mail transacional + webhook (`services/email_service.py`, `RESEND_*`)
- **Nemotron (NVIDIA)** — geração/assistência de IA (`services/nemotron_service.py`)

---

## 3. Arquitetura esperada

### Camadas (fluxo real obrigatório)

```
Frontend (pages → components → lib/api)
        │  HTTP (JSON / multipart)
        ▼
Backend route  (modules/<dominio>/routes.py)      ← entrada HTTP, sem regra de negócio
        │
Schema         (modules/<dominio>/schemas.py)     ← validação/saneamento do payload
        │
Service        (app/services/*.py)                ← regra de negócio / caso de uso
        │
Model          (app/models/*.py)                  ← SQLAlchemy / persistência
        │
PostgreSQL  +  Auditoria (app/models/audit.py)
```

Quando houver integração externa:

```
route → schema → service → Provider externo (Pagar.me / Resend / Nemotron) → Model → Auditoria/Logs
```

### Estrutura de pastas (real)

```
.
├── AGENTS.md                  ← este arquivo
├── skills/                    ← skills especializadas (ver seção 12)
├── backend/
│   ├── run.py
│   └── app/
│       ├── __init__.py        ← create_app(): CORS, headers de segurança, blueprints
│       ├── core/              ← config, extensions(db), jwt, password, security, rate_limit, errors
│       ├── domain/            ← permissions.py (scoped_query/roles), plan_rules.py
│       ├── bootstrap/         ← seed.py, migrations.py (migração de runtime)
│       ├── models/            ← users, orders, credits, plans, payments, financial, documents, audit, ...
│       ├── modules/<dominio>/ ← routes.py (+ schemas.py): auth, checkout, client_area, dashboard,
│       │                        documents, payments, split_payment, webhooks, admin, staff, me, ...
│       ├── services/          ← regra de negócio: credit_ledger, pagarme_service, checkout_service,
│       │                        email_service, nemotron_service, financial_service, ...
│       └── permissions/
├── frontend/
│   └── src/
│       ├── pages/             ← rotas: pages/{admin,client,staff} + Auth/Checkout/Signup/...
│       ├── components/        ← {admin, client, staff, landing, shared, ui}
│       ├── hooks/
│       └── lib/               ← clientes de API (api.ts, checkoutApi.ts, pedidos.ts, balance.ts...),
│                                máscaras, pricing (display), roles
├── infra/                     ← postgres, suporte de infra
├── migrations/
├── docs/                      ← arquitetura/segurança/auditorias (PARCIALMENTE DESATUALIZADO)
└── docker-compose.yml, nginx.conf, Dockerfile, Makefile
```

---

## 4. Regras obrigatórias (resumo executivo)

1. Toda regra de negócio nasce e vive no **backend**. O frontend nunca é a fonte da verdade.
2. **Valores monetários, saldos, preços e split são autoritativamente do backend.** O
   frontend pode formatar para exibição, nunca calcular o valor oficial.
3. **Toda mutação de saldo passa SOMENTE por `app/services/credit_ledger.py`.** Nunca
   escrever em `credit_transactions` em outro lugar. Tipos aceitos: **apenas `'in'` e `'out'`**.
4. Todo endpoint novo nasce dentro de um **módulo de domínio** (`modules/<dominio>/`).
5. Toda rota autenticada valida **autenticação + autorização (role + escopo de dados)** no backend.
6. **Proibido mocks/fake data em código de produção** (ver seção 9).
7. Toda ação crítica (pagamento, mudança de saldo, mudança de status de pedido, mudança de
   role, reembolso) gera **registro de auditoria** (`models/audit.py` / `services/audit_service.py`).
8. Dinheiro é tratado em **centavos (inteiros)** no backend; nunca usar `float` para valor financeiro.

---

## 5. Padrões de código

- **Backend (Python):** `from __future__ import annotations`, type hints, funções pequenas,
  exceções de domínio (`ValidationError`, `AuthError` em `core/errors.py`) — não retornar
  dict de erro cru. Mensagens de erro para usuário em **PT-BR**. Sem regra de negócio em `routes.py`.
- **Frontend (TS):** componentes funcionais + hooks; estado de servidor via **TanStack Query**
  (sem `fetch` solto espalhado); formulários com **react-hook-form + zod**; tipos vindos do
  backend declarados em `lib/api.ts`. Sem `any` desnecessário.
- **Nomes claros, em PT-BR para domínio** (pedido, saldo, prazo, crédito) e padrão técnico em inglês quando convém.
- **Sem arquivos `utils`/`helpers`/`misc` genéricos** sem contexto. Cada arquivo tem responsabilidade clara.

---

## 6. Padrões de backend

- Cada módulo: `routes.py` (HTTP), `schemas.py` (validação). Lógica em `services/`.
- `routes.py`: extrai/valida via schema → chama service → serializa resposta (`services/serializers.py`). Nada de SQL nem regra ali.
- `services/`: orquestra models, integra providers, aplica regras (`domain/plan_rules.py`, `domain/permissions.py`).
- Acesso a dados sempre via `scoped_query(model, actor)` quando a visibilidade depender do perfil.
- Transações de banco explícitas; em fluxos financeiros, usar o **advisory lock por usuário** já implementado no `credit_ledger`.

---

## 7. Padrões de frontend

- Páginas em `pages/` apenas compõem; lógica de chamada à API vive em `lib/*.ts`.
- **Toda leitura/escrita de dados passa pela API real.** Nada de array em memória fingindo banco.
- `localStorage`/`sessionStorage` **não** são banco de dados. Uso permitido: token de sessão,
  preferências de UI e cache não-autoritativo. Saldo, pedidos, preços e permissões **sempre** vêm da API.
- Botões de salvar/editar/excluir só existem se chamam endpoint real e tratam sucesso/erro.
- Preços exibidos vêm do backend (`lib/pricing.ts` formata, não inventa).

---

## 8. Padrões de banco de dados

- PostgreSQL 16 em produção. SQLite só para teste/dev rápido.
- Modelos em `models/` por agregado. Chaves estrangeiras, índices em colunas de filtro/busca.
- **Migrações:** alterações de schema entram em `migrations/` e/ou `bootstrap/migrations.py`
  (migração de runtime idempotente). Nunca quebrar `db.create_all()` do boot.
- Valores financeiros em **inteiro (centavos)**. Datas em UTC com timezone.
- `company_id` existe nas tabelas mas **NÃO filtra visibilidade** hoje (workspace único —
  ver `domain/permissions.py`). Não reintroduzir filtro por `company_id` sem decisão explícita documentada.

---

## 9. Proibições técnicas (anti-mock / anti-fake)

**Proibido em código de produção (frontend e backend):**

- Mock data, fake data, dados hardcoded, arrays simulando banco
- `localStorage`/`sessionStorage` como **banco/persistência principal**
- JSON local simulando API; APIs/serviços fake; usuário/permissão/role fake
- CRUD apenas visual; botões que **fingem** salvar/editar/excluir
- IDs fixos, datas fixas, dashboards/relatórios com números inventados
- Integrações externas (Pagar.me/Resend/Nemotron) **simuladas como se fossem reais**

**Dados de teste só são permitidos em:**

- `bootstrap/seed.py` (seed de dev), fixtures de teste, testes (`backend/tests`, Vitest),
  Storybook e ambiente **sandbox claramente identificado** (ex.: chaves de teste do Pagar.me).

> Detalhe operacional em `skills/anti-mock-audit`.

---

## 10. Padrões de segurança

- **Autenticação:** JWT HS256 (`core/jwt.py`), `sub` = `user_id`. Validar expiração e assinatura sempre.
- **Senhas:** `werkzeug` hash + `PASSWORD_SALT`. Força de senha validada no backend. Nunca logar senha/token.
- **Autorização:** role (`admin`/`staff`/`client`) **e** escopo de dados (`scoped_query`). Nunca confiar no frontend para bloquear ação sensível.
- **Headers:** definidos em `app/__init__.py` (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`; CSP + HSTS em produção).
- **CORS:** allowlist via `CORS_ALLOWED_ORIGINS` (sem allowlist em produção → erro de boot).
- **Rate limit:** login e cadastro (`core/rate_limit.py`).
- **Upload:** allowlist de extensão + bloqueio de extensões perigosas + **validação por magic bytes**
  + limite de tamanho + `secure_filename` (`core/security.py`). Nunca confiar na extensão do cliente.
- **Erros:** mensagens seguras, sem stack trace para o cliente; logs estruturados no servidor.
- **Segredos:** apenas em `.env` (nunca commitar). `.env.example` documenta as chaves.

---

## 11. Padrões de deploy na VPS

> **Regra obrigatória:** `docker compose restart` **NÃO é deploy**. Ele recria o container com
> a imagem antiga — o código novo nunca entra. Toda mudança de código exige rebuild da imagem.

### Comando canônico (único correto):

```bash
# Deploya tudo (backend + frontend)
make deploy

# Só backend (mais comum)
make deploy-backend

# Só frontend
make deploy-frontend
```

O `make deploy` executa `scripts/deploy.sh`, que faz em ordem:
1. `git pull origin main` na VPS
2. `docker compose up -d --build --no-deps <serviço>` — rebuild obrigatório
3. Healthcheck em `https://peticiona.app.br/api/health` até HTTP 200
4. Smoke test básico

### Nunca usar para deploy:

```bash
# ❌ ERRADO — roda imagem antiga, código novo não entra
docker compose restart backend
docker compose restart
docker compose up -d   # sem --build
```

---

## 12. Padrões de logs e auditoria

- Ações críticas (pagamento, crédito/débito, reembolso, mudança de status de pedido, mudança de
  role/perfil, reset de senha, eventos de webhook) registram **auditoria** (`models/audit.py`,
  `services/audit_service.py`) e/ou eventos (`models/email_event.py`).
- Logs de aplicação via `LOG_LEVEL`/`LOG_FILE`. **Nunca** logar segredos, tokens, senhas, dados de cartão.
- Webhooks (Pagar.me/Resend) validam assinatura/segredo antes de processar.

---

## 12. Como usar as skills

As skills ficam em `skills/<nome>/SKILL.md`. Cada uma é pequena, específica e operacional.
Para usar, **carregue o `SKILL.md` relevante e siga o checklist**. Mapa rápido:

| Situação | Skill |
|---|---|
| Decisão de arquitetura / onde colocar código | `skills/project-architecture` |
| Criar/revisar endpoint Flask | `skills/backend-api` |
| Conectar tela à API / revisar integração React | `skills/frontend-integration` |
| Modelar tabela / migração / índice | `skills/database-modeling` |
| Login, JWT, roles, escopo de dados | `skills/auth-rbac` |
| Saldo, créditos, checkout, split, reembolso | `skills/credit-ledger-payments` |
| Pagar.me / Resend / Nemotron / webhooks | `skills/external-integrations` |
| Auditoria OWASP / headers / upload | `skills/security-audit` |
| Caçar mock/fake/CRUD visual | `skills/anti-mock-audit` |
| Investigar bug | `skills/bug-investigation` |
| Preparar para produção / deploy | `skills/production-readiness` |
| Escrever/rodar testes | `skills/testing-quality` |
| Atualizar/corrigir documentação | `skills/documentation-architect` |

Em tarefas grandes, **combine skills** (ex.: nova feature de pagamento → `backend-api` +
`credit-ledger-payments` + `external-integrations` + `security-audit` + `testing-quality`).

---

## 13. Como resolver bugs

Siga `skills/bug-investigation`. Resumo:

1. **Reproduzir** com passos reais (request real, usuário real, role real).
2. **Localizar a camada** (frontend exibe? API responde? service calcula? model persiste?).
3. **Ler o código antes de mudar.** Confirmar a causa raiz, não o sintoma.
4. **Corrigir na camada certa** (regra de negócio → backend, nunca remendo no frontend).
5. **Adicionar teste** que falhava antes e passa depois.
6. **Verificar segurança/auditoria** se o bug toca saldo, pagamento, role ou acesso.

---

## 14. Como implementar novas features

1. Escolher/criar o **módulo backend** (`modules/<dominio>/`).
2. Definir **schema** de entrada (`schemas.py`, validação/saneamento).
3. Implementar **service** (regra de negócio; reusar `credit_ledger`, `domain/*`).
4. Expor **route** (autenticação + autorização + serialização).
5. **Migração de banco** se houver mudança de schema.
6. Consumir no **frontend** via `lib/*.ts` + TanStack Query; renderizar em `pages`/`components`.
7. **Auditoria/logs** para ações críticas.
8. **Testes** (pytest + Vitest) e atualização de **docs**.

---

## 15. Como finalizar uma tarefa (Definition of Done)

- [ ] Fluxo real ponta a ponta (frontend → API → service → banco), sem mock.
- [ ] Autenticação e autorização validadas no backend (role + escopo).
- [ ] Valores oficiais calculados no backend (centavos), frontend só exibe.
- [ ] Mutação de saldo apenas via `credit_ledger`; auditoria registrada quando aplicável.
- [ ] Validação/saneamento de entrada e tratamento seguro de erro.
- [ ] Testes adicionados/atualizados (pytest e/ou Vitest) e passando.
- [ ] `eslint`/lint e build do frontend OK; backend sobe sem erro.
- [ ] Documentação afetada atualizada (sem deixar `docs/` mentir).
- [ ] Nenhum segredo commitado; `.env.example` atualizado se surgiu variável nova.
