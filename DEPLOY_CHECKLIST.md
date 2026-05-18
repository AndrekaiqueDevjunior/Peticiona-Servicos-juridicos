# Checklist de deploy para produção

Resumo executivo do que mudou nas 3 fases de auditoria + suíte de testes e o
que ainda falta para a próxima subida estar segura.

---

## 1 — Estado do código (não-deployado ainda)

### Bugs corrigidos no working tree

| Id | Arquivo | Problema | Fix |
|----|---------|----------|-----|
| **B-1** | `backend/app/bootstrap/migrations.py:537` | `DROP TABLE … CASCADE` Postgres-only quebrava SQLite | Condicional por dialect |
| **B-2** | `backend/app/services/auth_service.py:13` | `_default_plan()` apontava para `code="starter"` ausente do seed → registro público falhava 100% | Fallback para plano ativo com menor `sort_order` |
| **B-3** | `backend/app/services/staff_service.py:13` | `_serialize_order_for_staff` chamava a si mesma (recursão infinita) | Trocado para `serialize_order` + ocultar `total_*`/`split_plataforma` + adicionar `staff_payout_*` |
| **B-4** | `backend/app/permissions/__init__.py:13` | `g.current_user` cacheado sem validar header `Authorization` → vazamento de identidade em setups que reusam app context | Cache passa a validar header; descarta na divergência |
| **B-5** | `backend/app/services/checkout_service.py:220-258` | Plano com `monthly_credits_cents=0` pago mas saldo não creditado; `_release_order` não-idempotente | Fallback para `order.amount` + idempotência + retry em `get_checkout_status` |
| **B-6** | `backend/app/services/admin_service.py:1051` | `create_admin_plan` aceitava `monthly_credits_cents=0` → mesmo bug do B-5 | Default vira `monthly_price_cents` quando admin omite |
| **B-7** | `backend/app/core/config.py:7` | `_load_dotenv()` rodava no nível de módulo e vazava o `.env` de produção para qualquer processo de teste/CI | Opt-out via `SKIP_DOTENV=1` |
| **B-8** | `app/services/order_comment_service.py:19` + 2 outros | `Model.query.get()` deprecado (SQLAlchemy 2.0 vai remover) | Migrado para `db.session.get(Model, id)` |

### Frontend já corrigido (no working tree)

- `Meus Dinheiros` → `Meus Saldos` ([ClientSidebar.tsx](frontend/src/components/client/ClientSidebar.tsx))
- `Ver meu Dinheiro` → `Ver meus Saldos` ([Checkout.tsx](frontend/src/pages/Checkout.tsx))
- `Comprar mais Dinheiro` → `Comprar mais Saldo` + removido texto "Estimativa local… backend" ([NewRequestDialog.tsx](frontend/src/components/client/NewRequestDialog.tsx))
- Modal de novo pedido: removida visão de "Redator" (cliente só vê como cliente)
- Perfil do funcionário: removido mock de "Ana Beatriz" — agora consome `GET /api/staff/profile` real
- Staff vê só `staff_payout_brl` (repasse), não o valor cheio cobrado do cliente
- Painel admin de financeiro: inclui Orders do checkout ([AdminFinancial.tsx](frontend/src/pages/admin/AdminFinancial.tsx))

### Suíte de testes adicionada (339 testes, 75% de cobertura)

```
backend/
├── pytest.ini
├── conftest.py
└── tests/
    ├── conftest.py
    ├── factories/  (users, business)
    ├── utils/  (auth helpers, ApiClient, mocks)
    └── modules/
        ├── auth/ (register + login)
        ├── admin/ (10 sub-rotas)
        ├── client_area/ (E2E + extras)
        ├── checkout/ (flow + 9 testes de regressão dos bugs)
        ├── webhooks/ (pagarme HMAC + resend svix)
        ├── comments/, me/, petitions/, payments/
        └── test_content.py, test_contact_dashboard_health.py, test_split_payment.py
```

---

## 2 — Checklist antes do deploy

### 2.1 Validações locais
- [ ] `cd backend && ./venv/bin/pytest tests/ -q` → todos verdes (esperado: **339 passed**)
- [ ] `cd backend && ./venv/bin/pytest tests/ --cov=app --cov-report=term | tail -3` → cobertura ≥ 70%
- [ ] Frontend builda sem erro: `npm run build` na raiz
- [ ] Lint frontend passa: `npm run lint`
- [ ] `git status` mostra só os arquivos esperados — nada de `.env`, `backend/venv/`, `.coverage`

### 2.2 Variáveis de ambiente em produção

Confirme no `.env` da VPS / no painel do orquestrador:

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `DATABASE_URL` | sim | postgres da produção |
| `FLASK_SECRET_KEY` | sim | ≥ 32 bytes aleatórios |
| `JWT_SECRET` | sim | ≥ 32 bytes; pode ser igual ao SECRET_KEY |
| `CORS_ALLOWED_ORIGINS` | sim | inclui `https://peticiona.app.br` |
| `PAGARME_SECRET_KEY` | sim | `sk_live_...` ou `sk_test_...` |
| `PAGARME_PUBLIC_KEY` | sim | `pk_live_...` para frontend tokenizar |
| `PAGARME_WEBHOOK_TOKEN` | sim | para HMAC de webhooks |
| `PAGARME_DRY_RUN` | dev/staging | `false` em produção real |
| `RESEND_API_KEY` | sim para emails | senão emails caem em SMTP/dry-run |
| `RESEND_FROM_EMAIL` | sim para emails | ex. `no-reply@peticiona.app.br` |
| `RESEND_WEBHOOK_SECRET` | sim | `whsec_...` — sem isso webhook aceita qualquer um |
| `NOTIFICATION_EMAIL` | sim | destino das notificações internas |
| `FRONTEND_URL` | sim | `https://peticiona.app.br` (usado nos emails) |
| `DEBUG` | **não setar** ou `false` | ativa CSP, HSTS, exige assinatura em webhooks |
| `RATE_LIMIT_ENABLED` | `true` | sem isso a rota `/auth/login` é livre |

### 2.3 Pré-deploy
- [ ] Backup do banco de produção
- [ ] Confirmar que `.env` em produção **não** contém `SKIP_DOTENV=1`
- [ ] Conferir que `PAGARME_DRY_RUN` está `false` em prod
- [ ] Branch local sincronizada com o remote
- [ ] Commits feitos com mensagens descritivas (sugestão: 1 commit para fixes B-1…B-8, 1 para suíte de testes, 1 para frontend)

### 2.4 Sequência de deploy
1. `git push origin main` (após `git commit`)
2. VPS: `git pull && cd backend && pip install -r requirements.txt`
3. VPS: rodar migrações: `gunicorn` recriará app context que executa `run_runtime_migrations()` automaticamente
4. VPS: `cd frontend && npm install && npm run build && rsync -av dist/ /var/www/peticiona/`
5. Reload do backend (`systemctl restart peticiona-api` ou `docker compose restart api`)
6. Reload do nginx se serve o frontend estático

### 2.5 Smoke test pós-deploy
- [ ] `GET https://peticiona.app.br/api/health` → 200 `{"status": "ok"}`
- [ ] Logar como cliente real → sidebar mostra "Meus Saldos" (não "Meus Dinheiros")
- [ ] Painel admin → /admin/financeiro mostra a compra que estava sumida
- [ ] Perfil staff (`/area-interna/perfil`) → dados reais, não "Ana Beatriz Souza"
- [ ] Funcionário vê "Seu repasse" em vez de "Valor" no financial
- [ ] Cliente consegue baixar documento do próprio pedido
- [ ] Anônimo NÃO consegue baixar documento (espera 401)
- [ ] Compra de plano via checkout deposita saldo na aba "Saldos" do cliente

---

## 3 — Pontos ainda abertos (não bloqueiam deploy)

### Cobertura ainda baixa
- `email_service.py` (25%) — testar exige mockar HTTP do Resend/SendGrid; valor pequeno
- `pagarme_service.py` (30%) — só a camada HTTP cliente; o fluxo está coberto via `fake_pagarme`
- `nemotron_service.py` (0%) — serviço de IA ainda não exposto em rota
- `staff_service.py` (41%) — endpoints todos cobertos, mas serializadores internos ainda não

### Decisões arquiteturais sugeridas (futuro)
1. **Quebrar `admin_service.py` (641 LOC)** em sub-services (`admin_orders_service`, `admin_clients_service`, etc.) — reduz risco de bugs do tipo B-3
2. **Mover migrações de runtime para Alembic** — `run_runtime_migrations()` é uma lista de DDLs imperativos; Alembic versionado evita repetir B-1
3. **Padronizar status codes**: alguns POSTs do admin retornam 200 onde 201 seria mais correto
4. **Health endpoint deep-check** — `/api/health?deep=1` que valide DB + Pagar.me

### Observações de segurança
- Em produção, `DEBUG=False` faz o webhook Pagar.me **exigir** assinatura HMAC (ver `app/modules/webhooks/routes.py:73`). Sem `PAGARME_WEBHOOK_TOKEN` configurado, o webhook responde 401 — bom para fail-closed.
- O fix B-4 fechou um vetor teórico de bypass de auth em workers que reusam app context. Não havia evidência de exploração em produção, mas o fix é defensivo.
- O fix B-7 (`SKIP_DOTENV`) evita que processos de CI carreguem o `.env` real — confirme que o ambiente de prod **não** define essa variável.

---

## 4 — Comandos prontos

```bash
# Validação completa
cd backend
./venv/bin/pytest tests/ -q --cov=app --cov-report=term

# Smoke do app local com SQLite
SKIP_DOTENV=1 CORS_ALLOWED_ORIGINS=http://localhost:3000 \
  ./venv/bin/python -c "from app import create_app; app=create_app({'TESTING':True,'SQLALCHEMY_DATABASE_URI':'sqlite:///:memory:'}); print('boot OK', len(list(app.url_map.iter_rules())), 'rotas')"

# Frontend build (na raiz)
cd ..
npm install
npm run lint
npm run build
```
