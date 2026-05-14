# Relatório de Auditoria — Peticiona Production Readiness

## Resumo Executivo

Este relatório mapeia rotas, endpoints de pagamento, modelos financeiros, migrations, segurança e infraestrutura do sistema Peticiona. O objetivo é identificar o que deve ser mantido, removido ou corrigido antes do deploy em produção com pagamentos reais via Pagar.me.

---

## 1. Rotas Flask Registradas

### 1.1 Auth (`/api/auth`)
| Método | Rota | Uso |
|--------|------|-----|
| POST | `/register` | Registro público |
| POST | `/login` | Login |
| POST | `/password-reset/request` | Solicitar reset |
| POST | `/password-reset/confirm` | Confirmar reset |

### 1.2 Me (`/api/me`)
| Método | Rota | Uso |
|--------|------|-----|
| GET | `''` | Perfil do usuário |
| PUT/PATCH | `''` | Atualizar perfil |
| GET | `/balance` | Saldo do cliente |
| GET | `/documents` | Documentos do cliente |
| GET | `/terms` | Termos aceitos |
| POST | `/password` | Alterar senha |
| POST | `/terms` | Aceitar termos |

### 1.3 Client Area (`/api/client-area`)
| Método | Rota | Uso |
|--------|------|-----|
| GET | `''` | Catálogo de serviços |
| POST | `/cart/preview` | Preview do carrinho |
| POST | `/orders` | Criar pedido (cliente) |
| GET | `/orders` | Listar pedidos |
| POST | `/orders/preview` | Preview do pedido |
| GET | `/orders/<id>` | Detalhe do pedido |
| PUT/PATCH | `/orders/<id>` | Editar pedido |
| DELETE | `/orders/<id>` | Cancelar pedido |
| POST | `/documents` | Upload de documentos |
| DELETE | `/documents/<id>` | Remover documento |

### 1.4 Checkout (`/api/checkout`) — **FLUXO ATIVO**
| Método | Rota | Uso |
|--------|------|-----|
| GET | `/config` | Chave pública Pagar.me |
| POST | `/create-order` | Criar ordem de checkout |
| POST | `/create-payment` | Processar pagamento |
| GET | `/status/<id>` | Consultar status |

### 1.5 Payments (`/api/payments`) — **LEGADO / PARCIALMENTE ÓRFÃO**
| Método | Rota | Uso |
|--------|------|-----|
| GET | `/credit-packages` | Listar pacotes de crédito (não usado pelo frontend) |
| POST | `/credit-orders` | Criar compra de crédito legada (não usado pelo frontend) |
| POST | `/pagarme/webhook` | Webhook Pagar.me legado (não usado — o ativo está em `/api/webhooks/pagarme`) |
| GET | `/smoke` | Teste de conectividade (admin/staff) |
| POST | `/smoke-charge` | Carga de teste R$ 1,00 (admin/staff) |

### 1.6 Webhooks (`/api/webhooks`) — **FLUXO ATIVO**
| Método | Rota | Uso |
|--------|------|-----|
| POST | `/pagarme` | Webhook Pagar.me (ativo, com HMAC em produção) |

### 1.7 Admin (`/api/admin`)
| Método | Rota | Uso |
|--------|------|-----|
| GET | `/profile` | Perfil admin |
| PUT | `/profile` | Atualizar perfil |
| GET | `/settings/contact` | Configurações |
| PUT/PATCH | `/settings/contact` | Atualizar configurações |
| GET/POST | `/orders` | CRUD de pedidos |
| GET/PUT/PATCH/DELETE | `/orders/<id>` | Detalhe/edição/exclusão |
| PATCH | `/orders/<id>/status` | Atualizar status |
| GET/POST | `/clients` | CRUD de clientes |
| GET/PUT/PATCH/DELETE | `/clients/<id>` | Detalhe/edição/exclusão |
| GET/POST | `/staff` | CRUD de funcionários |
| GET/PUT/PATCH/DELETE | `/staff/<id>` | Detalhe/edição/exclusão |
| GET | `/financial` | Resumo financeiro |
| GET | `/financial/entries` | Lançamentos financeiros |
| GET | `/financial/transactions` | Alias para entries |
| GET | `/credit-purchases` | **Listar compras de crédito (admin)** |
| POST | `/credit-purchases/<id>/refund` | **Estornar compra de crédito (admin)** |
| POST | `/financial/refund` | Reembolso financeiro |
| GET/POST | `/financial/entries` | CRUD lançamentos |
| GET/PUT/PATCH/DELETE | `/financial/entries/<id>` | CRUD lançamentos |
| GET/POST | `/plans` | CRUD planos |
| GET/PUT/PATCH/DELETE | `/plans/<id>` | CRUD planos |
| POST | `/services` | Criar serviço |
| GET/PUT/PATCH/DELETE | `/services/<id>` | CRUD serviços |

### 1.8 Outros módulos
- **Staff** (`/api/staff`): dashboard, orders, upload de documentos
- **Petitions** (`/api/petitions`): criação e listagem de petições
- **Documents** (`/api/documents`): download
- **Content** (`/api/content`): home, plans, contact
- **Comments** (`/api/comments`): CRUD de comentários em pedidos
- **Health** (`/api/health`): healthcheck
- **Dashboard** (`/api/dashboard`): dados do dashboard
- **Split Payment** (`/api/split-payment`): preview de split
- **Notifications** (`/api/notifications`): notificações

---

## 2. Chamadas Reais Frontend → API

### 2.1 Checkout (pagamento ativo)
- `checkoutApi.config()` → `GET /api/checkout/config`
- `checkoutApi.createOrder(...)` → `POST /api/checkout/create-order`
- `checkoutApi.createPayment(...)` → `POST /api/checkout/create-payment`
- `checkoutApi.status(id)` → `GET /api/checkout/status/<id>`
- `tokenizeCard(...)` (frontend → Pagar.me direto, tokenização no browser)

### 2.2 Cliente
- `api.me.get()` → `GET /api/me`
- `api.me.update(...)` → `PUT /api/me`
- `api.me.balance()` → `GET /api/me/balance`
- `api.me.documents()` → `GET /api/me/documents`
- `api.me.changePassword(...)` → `POST /api/me/password`
- `api.me.acceptTerms(...)` → `POST /api/me/terms`
- `api.clientArea.catalog()` → `GET /api/client-area`
- `api.clientArea.previewCart(...)` → `POST /api/client-area/cart/preview`
- `api.clientArea.createOrder(...)` → `POST /api/client-area/orders`
- `api.clientArea.listOrders()` → `GET /api/client-area/orders`
- `api.clientArea.previewOrder(...)` → `POST /api/client-area/orders/preview`
- `api.clientArea.getOrder(id)` → `GET /api/client-area/orders/<id>`
- `api.clientArea.updateOrder(id, ...)` → `PATCH /api/client-area/orders/<id>`
- `api.clientArea.deleteOrder(id)` → `DELETE /api/client-area/orders/<id>`
- `api.clientArea.uploadDocuments(...)` → `POST /api/client-area/documents`
- `api.clientArea.deleteDocument(id)` → `DELETE /api/client-area/documents/<id>`

### 2.3 Admin
- `api.admin.financial.summary()` → `GET /api/admin/financial`
- `api.admin.financial.entries()` → `GET /api/admin/financial/entries`
- `api.admin.financial.creditPurchases()` → `GET /api/admin/credit-purchases`
- `api.admin.financial.refundPurchase(id)` → `POST /api/admin/credit-purchases/<id>/refund`
- CRUD de orders, clients, staff, plans, services

### 2.4 Auth
- `api.auth.register(...)` → `POST /api/auth/register`
- `api.auth.login(...)` → `POST /api/auth/login`
- `api.auth.forgotPassword(...)` → `POST /api/auth/password-reset/request`
- `api.auth.resetPassword(...)` → `POST /api/auth/password-reset/confirm`

### 2.5 Conclusão
**NENHUMA** chamada frontend utiliza:
- `GET /api/payments/credit-packages`
- `POST /api/payments/credit-orders`
- `POST /api/payments/pagarme/webhook`

Esses endpoints são **órfãos** para o fluxo de pagamento do cliente. O único uso legado do modelo `CreditPurchase` é no **painel admin** (`/api/admin/credit-purchases` e `/api/admin/credit-purchases/<id>/refund`), para listagem e estorno de compras de crédito.

---

## 3. Endpoints de Pagamento — Status

### 3.1 Fluxo Ativo (Checkout)
- **Entrada**: `/api/checkout/create-order` → `/api/checkout/create-payment`
- **Webhook**: `/api/webhooks/pagarme` (HMAC obrigatório em produção)
- **Serviço**: `checkout_service.py` (idempotência, tokenização, sanitização de logs, crédito via `CreditTransaction`)
- **Frontend**: `Checkout.tsx` + `checkoutApi.ts`

### 3.2 Fluxo Legado (CreditPurchase)
- **Entrada**: `/api/payments/credit-orders` (órfão de frontend cliente)
- **Webhook**: `/api/payments/pagarme/webhook` (órfão — duplicado com `/api/webhooks/pagarme`)
- **Serviço**: `credit_payment_service.py` (não chamado pelo frontend cliente)
- **Uso admin**: `/api/admin/credit-purchases` e `/api/admin/credit-purchases/<id>/refund` são usados pelo `AdminFinancial.tsx`

### 3.3 Smoke Tests (Admin/Staff)
- `GET /api/payments/smoke` e `POST /api/payments/smoke-charge` são usados internamente para validar integração com Pagar.me.

---

## 4. Modelos Financeiros

### 4.1 Fonte de verdade do saldo
`CreditTransaction` (`app/models/credits.py`):
- `user_id`, `company_id`
- `type`: `'in'` (crédito) ou `'out'` (débito)
- `source`: identifica origem (ex: `'pagarme_checkout'`)
- `amount`: valor em centavos
- `description`
- Unique constraint parcial: `(user_id, source, description) WHERE source IS NOT NULL` (evita duplicatas)

### 4.2 Outros modelos financeiros
| Modelo | Uso | Status |
|--------|-----|--------|
| `Order` | Ordens de checkout (pagamento ativo) | **Ativo** |
| `PaymentEvent` | Eventos de pagamento (log) | **Ativo** |
| `CreditPurchase` | Compras de crédito legadas | **Legado — usado apenas pelo admin** |
| `FinancialEntry` | Lançamentos financeiros manuais (admin) | **Ativo** |
| `ServiceOrder` | Pedidos de serviço do cliente | **Ativo** |
| `ServiceOrderItem` | Itens do pedido | **Ativo** |

### 4.3 Cálculo de saldo
- `user_service.py` → `get_balance_snapshot()` → `financial_service.py`
- Soma `type = 'in'` e subtrai `type = 'out'` de `CreditTransaction`
- Retorna: `credits_available`, `credits_total`, `credits_used` + `movements`

---

## 5. Migrations

Não há sistema de migrations tradicional (Alembic/Flask-Migrate). O projeto utiliza **runtime migrations** em `app/bootstrap/migrations.py`:

- Adiciona colunas novas (users, service_orders, plans)
- Cria tabelas se não existirem (financial_entries, terms_acceptances, order_comments)
- Backfills (petitions → service_orders, débitos órfãos, missing order debits)
- Corrige schema legado (colunas nullable, tipos)
- Normaliza tipos de transação (`credit`/`debit` → `in`/`out`)
- Cria unique constraint parcial em `credit_transactions`
- Limpa débitos órfãos de usuários sem crédito

**Atenção**: em produção com múltiplos workers, o sistema utiliza `pg_advisory_xact_lock(784231337)` para evitar concorrência no boot.

**Recomendação**: monitorar logs no primeiro boot em produção para garantir que as runtime migrations rodaram sem erro.

---

## 6. Segurança

### 6.1 PCI-DSS / Tokenização
- Backend **rejeita dados de cartão brutos** (número, CVV, exp_month, exp_year, holder_name)
- Exige `card_token` (tokenizado pelo frontend via SDK Pagar.me)
- Frontend nunca envia dados de cartão para o backend
- Logs são sanitizados (`_sanitize_payload`) — rem número, CVV, token, documento, telefone

### 6.2 Webhook
- Em produção: exige assinatura HMAC (`X-Hub-Signature-256` ou similares)
- Em desenvolvimento: permite token (`X-Pagarme-Webhook-Token`) como fallback
- Rate limit: 60 req/min no webhook

### 6.3 Rate Limiting
- Auth: limitado por endpoint
- Checkout: limitado por endpoint e janela (ex: 5 pagamentos / 120s)
- Admin smoke-charge: limitado
- Implementado em `app/core/rate_limit.py`

### 6.4 Configurações de produção
- `SECRET_KEY` ≥ 32 caracteres (validado em `config.py`)
- `PAGARME_DRY_RUN` = `False` (padrão)
- `DATABASE_URL` deve apontar para PostgreSQL
- CORS restrito a domínios de produção
- JWT expira em 1h (3600s)

### 6.5 Infraestrutura
- `docker-compose.yml` com PostgreSQL 16, backend (gunicorn + gevent), frontend (Next.js)
- Healthcheck no backend via `/api/health`
- Backend exposto em `127.0.0.1:5000` (não público direto)
- Gunicorn: 2 workers, gevent, `post_fork` descarta conexões herdadas

---

## 7. Testes Automatizados

| Arquivo | Cobertura |
|---------|-----------|
| `backend/tests/test_checkout_security.py` | PCI-DSS: rejeição de dados brutos, sanitização, token requirement |
| `backend/tests/test_password_reset.py` | Reset de senha |

**Observação**: não há testes de integração para webhook, idempotência, ou fluxo completo de pagamento. Recomenda-se adicionar testes de webhook HMAC e testes de integração do checkout.

---

## 8. Recomendações

### 8.1 Manter
- Fluxo de checkout (`/api/checkout/*`, `/api/webhooks/pagarme`)
- Endpoints admin de `CreditPurchase` (`/api/admin/credit-purchases`, `/api/admin/credit-purchases/<id>/refund`) — usados pelo `AdminFinancial.tsx`
- Smoke tests (`/api/payments/smoke`, `/api/payments/smoke-charge`) — úteis para validação
- Runtime migrations — essenciais para evolução do schema

### 8.2 Remover / Desativar
- **`/api/payments/credit-packages`** — não usado pelo frontend
- **`/api/payments/credit-orders`** — não usado pelo frontend
- **`/api/payments/pagarme/webhook`** — duplicado com `/api/webhooks/pagarme`. Risco de processar o mesmo evento 2x

**Importante**: antes de remover, verificar se algum webhook externo (Pagar.me) ainda aponta para `/api/payments/pagarme/webhook`. Caso sim, migrar para `/api/webhooks/pagarme`.

### 8.3 Riscos
1. **Duplicidade de webhook**: `/api/payments/pagarme/webhook` e `/api/webhooks/pagarme` processam o mesmo payload. Se ambos estiverem registrados no Pagar.me, o mesmo pagamento pode ser creditado 2x. **Ação imediata**: verificar no dashboard Pagar.me qual URL está registrada e desativar a duplicada.
2. **Runtime migrations em produção**: não há Alembic. Migrations rodam no boot. Se houver erro, o worker pode falhar silenciosamente. **Ação**: monitorar logs no primeiro deploy.
3. **Falta de testes de integração**: não há teste end-to-end do webhook nem de idempotência real. **Ação**: adicionar testes com mock de gateway.
4. **JWT em localStorage**: o token é armazenado no localStorage (vulnerável a XSS). Mitigado por CSP, mas recomenda-se avaliar httponly cookies no futuro.
5. **Split de repasse**: o sistema calcula split admin-funcionário (`split_plataforma`/`split_funcionario`), mas não há evidência de pagamento automático ao funcionário. **Ação**: confirmar se o repasse é manual.

### 8.4 Checklist de Deploy
- [ ] `DATABASE_URL` aponta para PostgreSQL (não SQLite)
- [ ] `SECRET_KEY` ≥ 32 caracteres e gerada aleatoriamente
- [ ] `PAGARME_SECRET_KEY` e `PAGARME_PUBLIC_KEY` são de produção
- [ ] `PAGARME_DRY_RUN=false`
- [ ] `PAGARME_WEBHOOK_TOKEN` configurado
- [ ] Webhook no dashboard Pagar.me aponta para `https://<dominio>/api/webhooks/pagarme`
- [ ] Nenhum webhook duplicado apontando para `/api/payments/pagarme/webhook`
- [ ] `CORS_ALLOWED_ORIGINS` restrito ao domínio de produção
- [ ] `FLASK_DEBUG=false` / `DEBUG=false`
- [ ] HTTPS forçado (reverse proxy / load balancer)
- [ ] SMTP/SendGrid configurado para notificações
- [ ] Logs sanitizados verificados (sem PAN, CVV, token)
- [ ] Healthcheck `/api/health` funcional
- [ ] Primeiro boot em produção monitorado para runtime migrations
- [ ] Testes automatizados passando (`pytest backend/tests/`)
- [ ] `uploads` volume persistente configurado

---

## 9. Dependências entre Legacy e Ativo

| Componente | Depende de CreditPurchase? | Nota |
|------------|---------------------------|------|
| `Checkout.tsx` | Não | Usa `/api/checkout/*` |
| `Balance.tsx` | Indireto | Saldo vem de `CreditTransaction`, não de `CreditPurchase` |
| `AdminFinancial.tsx` | **Sim** | Lista e estorna compras legadas |
| `payments/routes.py` | Sim | Expõe endpoints legados |
| `admin/routes.py` | Sim | Expõe `/api/admin/credit-purchases` |
| `admin_service.py` | Sim | Implementa listagem e estorno |
| `credit_payment_service.py` | Sim | Implementa lógica legada |
| `models/payments.py` | Sim | Define `CreditPurchase` |

**Decisão**: `CreditPurchase` não pode ser removido completamente sem refatorar o painel admin. Os endpoints de **pagamento** legados (`/api/payments/credit-*`) podem ser desativados com segurança. O webhook legado (`/api/payments/pagarme/webhook`) deve ser desativado imediatamente para evitar duplicidade.

---

*Relatório gerado em: auditoria de produção — Peticiona.*
