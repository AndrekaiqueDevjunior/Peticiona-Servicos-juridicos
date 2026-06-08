# SKILLS.md — Guia de Trabalho para IA no Projeto Peticiona

## 1. Contexto do Projeto

**Peticiona** é um SaaS web para gestão de serviços jurídicos sob demanda.

Advogados podem contratar petições, pareceres e consultoria elaboradas por especialistas, com prazos previsíveis e custo transparente.

O objetivo da IA é ajudar a:
- Desenvolver features novas
- Auditar e corrigir bugs
- Integrar frontend com backend
- Melhorar arquitetura e performance
- Manter código seguro e pronto para produção
- Validar regras de negócio

Antes de alterar código, a IA deve entender:
- Qual tela ou fluxo está sendo afetado
- Qual entidade do banco está envolvida
- Qual endpoint é usado
- Qual regra de negócio precisa ser preservada
- Se existe risco de quebrar autenticação, permissões ou isolamento de dados (multitenant)

---

## 2. Stack Principal

### Frontend
- **React 18** com hooks (não class components)
- **TypeScript** strict mode (sem `any`)
- **Vite** (dev server rápido, ESM-first)
- **React Router v6** (nested routes)
- **TailwindCSS** + **shadcn/ui** (componentes acessíveis)
- **React Query** (data fetching, caching)
- **Zod** para validação (tipos derivados do schema)

### Backend
- **Flask 3.0+** (Python)
- **SQLAlchemy** (ORM)
- **PostgreSQL 16**
- **JWT** para autenticação
- **Blueprints** para modularização
- **Gunicorn + gevent** (production WSGI)

### Banco de Dados
- **PostgreSQL 16** com advisory locks
- **SQLAlchemy** models com relacionamentos complexos
- **Runtime migrations** (zero-downtime DDL)
- **company_id scoping** para multitenancy

### Infraestrutura
- **Docker + Docker Compose**
- **Nginx** reverse proxy com SSL
- **Ubuntu 24.04** na VPS
- **Environment variables** para secrets
- **.env** e **.env.vps** (gitignored)

---

## 3. Domínio de Negócio Essencial

### Sistema de Créditos
- **1 crédito = 1 serviço**
- Ledger-based tracking (tabela `credit_transactions` imutável)
- Suporta diferentes tipos: `kind='common'` (créditos) vs `kind='legacy_cents'` (deprecated)
- Debit imediato ao criar pedido (reserva antes do pagamento)
- Proteção contra race conditions via advisory locks

### Tipos de Serviço
| Tipo | Preço | Prazo | Créditos |
|------|-------|-------|----------|
| Avulso | R$180 | 3 dias úteis | 1 |
| Essencial | R$160 | 3 dias úteis | 1 (requer plano) |
| Profissional | R$200 | 3 dias úteis | 1 (requer plano) |
| Estratégico | R$300 | 2 dias úteis | 1 (requer plano) |

### Express Upgrade
- **+R$40** add-on que reduz prazo
- Aplicado via checkout (não é serviço separado)
- Flag `express_upgrade=true` no ServiceOrder

### Prazos (Dias Úteis)
- Calculados em **dias úteis** (seg-sex)
- Respeitam **16 feriados fixos** (Natal, Independência, etc)
- Respeitam **Páscoa móvel** (algoritmo de Meeus)
- Ignoram fins de semana
- Auto-calculados em `app/services/prazos_service.py`

### Fluxo de Pagamento
1. Cliente cria petição → ServiceOrder criado
2. 1 crédito debitado (se tem saldo)
3. Cliente vai para checkout
4. Webhook confirma pagamento
5. ServiceOrder status atualizado
6. Prazo calculado (se não for express)

### Isolamento de Dados (Multitenant)
- Toda entidade de negócio está vinculada a `company_id`
- Toda query filtra pelo tenant atual (via `scoped_query()`)
- **Nunca** aceitar `company_id` livremente do frontend
- Usuário só acessa dados da organização dele
- Testar sempre: um usuário consegue ver dados de outro tenant?

---

## 4. Arquitetura Frontend

### Estrutura de Diretórios

```
frontend/src/
├── pages/               # Route-level components
│   ├── admin/           # Dashboard admin
│   ├── client/          # Painel cliente
│   ├── Index.tsx        # Landing page
│   ├── Auth.tsx         # Login/register
│   ├── Checkout.tsx     # Fluxo pagamento
│   └── ForgotPassword.tsx
├── components/
│   ├── admin/           # UI específica admin
│   ├── client/          # UI específica client
│   ├── landing/         # UI marketing
│   └── ui/              # Primitivos (Button, Card, Dialog, Input)
├── lib/
│   ├── api.ts           # API client type-safe
│   ├── auth.ts          # Auth context
│   ├── contactInfo.ts   # Global contact state
│   ├── prazos.ts        # Calcular dias úteis (mirror do backend)
│   └── hooks.ts         # Custom hooks
├── hooks/               # React hooks reutilizáveis
└── App.tsx              # Router setup
```

### API Client Type-Safe (`lib/api.ts`)

Padrão namespace com generics:

```typescript
export const api = {
  auth: {
    login: (email, password) => 
      request<{ token: string; user: User }>("/auth/login", ...),
  },
  admin: {
    orders: {
      list: () => request<Order[]>("/admin/orders"),
      create: (payload) => request<Order>("/admin/orders", ...),
    },
    settings: {
      contact: {
        get: () => request<ContactInfo>("/admin/settings/contact"),
        update: (data) => request<ContactInfo>("/admin/settings/contact", ...),
      },
    },
  },
};
```

### Padrão de Estado

- **Context API** para estado global (auth, contact)
- **localStorage** como cache (com fallback API)
- **Component state** para UI local (forms, modals)
- **CustomEvent** para sincronização entre abas

Exemplo:
```typescript
// lib/contactInfo.ts
export function useContactInfo() {
  const [contact, setContact] = useState(DEFAULT_CONTACT);
  
  useEffect(() => {
    // Fetch API
    api.contact.get().then(setContact);
    // Sync entre abas
    window.addEventListener('contactInfoUpdated', (e) => 
      setContact(e.detail)
    );
  }, []);
  
  return contact;
}
```

### Regras do Frontend

1. **Nunca confiar apenas no frontend** para:
   - Preço de serviço
   - Plano do usuário
   - Permissões
   - company_id
   - user_id
   - Status de pagamento

2. **Sempre enviar para API real**:
   - Dados de um form
   - Criação/edição/exclusão
   - Operações críticas

3. **Nunca mockar** se backend real existe ou não,  nunca mockar features no UI / UX

4. **Sempre ter**:
   - Loading state
   - Error state
   - Success feedback
   - Validação (Zod)

---

## 5. Arquitetura Backend

### Estrutura de Diretórios

```
backend/app/
├── modules/             # Feature blueprints
│   ├── auth/            # Login, register, password reset
│   ├── admin/           # Admin dashboard
│   ├── client/          # Client area
│   ├── me/              # Current user
│   ├── content/         # Landing page content
│   └── payments/        # Webhook handlers
├── services/            # Business logic
│   ├── petition_service.py
│   ├── checkout_service.py
│   ├── admin_service.py
│   ├── credit_ledger.py
│   ├── prazos_service.py
│   ├── password_reset_service.py
│   └── settings_service.py
├── models/              # SQLAlchemy ORM
│   └── __init__.py      # Todas as entidades
├── core/                # Cross-cutting concerns
│   ├── extensions.py    # db, mail init
│   ├── security.py      # Password hashing
│   ├── errors.py        # Custom exceptions
│   └── references.py    # Reference generation (PET-NNNNNN)
├── domain/              # Business rules
│   └── permissions.py   # @roles_required, scoped_query()
├── bootstrap/           # Runtime migrations
│   └── migrations.py    # Zero-downtime DDL
└── __init__.py          # create_app() factory
```

### Padrão de Serviço

Cada serviço é função pura que:
1. Valida inputs
2. Aplica regra de negócio
3. Persiste no banco
4. Retorna resultado serializado

Exemplo:
```python
def create_petition(user, payload: dict) -> dict:
    # Validar
    area_direito = payload.get("area_direito") or ""
    if not area_direito:
        raise ValidationError("Área do Direito é obrigatória.")
    
    # Criar petição
    petition = Petition(...)
    db.session.add(petition)
    db.session.flush()
    
    # Criar ordem de serviço
    order = _create_service_order_for_petition(user, petition, payload)
    
    # Registrar auditoria
    log_action(action="petition.created", entity_id=petition.id, user=user)
    
    db.session.commit()
    return {
        "petition": serialize_petition(petition),
        "order": serialize_order(order),
    }
```

### Padrão de Endpoint

```python
@admin_bp.post("/orders")
@roles_required("admin")
def create_admin_order():
    actor = current_actor()  # Usuario autenticado
    payload = request.get_json() or {}
    result = create_admin_order(actor, payload)
    return jsonify(result), 201
```

### Proteção Multitenant

```python
def _scoped_user(actor, user_id, role="client"):
    """Garante que actor tem permissão de acessar user_id"""
    user = User.query.get(user_id)
    if not user:
        raise PermissionDenied("User not found")
    if user.company_id != actor.company_id:
        raise PermissionDenied("User from different company")
    if role and user.role != role:
        raise PermissionDenied(f"User is not {role}")
    return user
```

### Credit System com Race Condition Safety

```python
def debit(user_id, amount, **options):
    """Debit atomicamente com advisory lock"""
    _execute("SELECT pg_advisory_xact_lock(:uid)", {"uid": user_id})
    
    current = compute_balance(user_id, kind=options["kind"])
    if current < amount:
        raise InsufficientBalance(f"Need {amount}, have {current}")
    
    db.session.execute(text("""
        INSERT INTO credit_transactions (user_id, type, amount, kind, ...)
        VALUES (:uid, 'out', :amt, :kind, ...)
    """), {"uid": user_id, "amt": amount, "kind": options["kind"]})
    
    db.session.commit()
```

---

## 6. Banco de Dados

### Entidades Principais

| Tabela | Propósito | Chave |
|--------|-----------|-------|
| users | Usuários (admin/staff/client) | id |
| companies | Organizações (multitenant) | id |
| petitions | Petições criadas | id |
| service_orders | Pedidos de serviço | id |
| credit_transactions | Ledger de créditos | id |
| platform_settings | Configurações globais | key |

### Regras de Foreign Key

- Toda entidade de negócio tem `company_id`
- `service_orders` vinculado a `user_id` (cliente)
- `petitions` vinculado a `user_id`
- `credit_transactions` vinculado a `user_id` + `kind`

### Migrations

Usar padrão zero-downtime:

```python
def _execute(sql: str) -> None:
    db.session.execute(text(sql))

def _add_column_if_not_exists():
    if "new_column" in _column_names("service_orders"):
        return
    _execute("ALTER TABLE service_orders ADD COLUMN new_column TYPE")
```

**Nunca** fazer `DROP TABLE` ou `DROP COLUMN` sem soft delete.

---

## 7. Segurança

### Autenticação

- **JWT** com 1 hora de expiração
- **Scrypt** password hashing (adaptivo, resistente a brute force)
- Rate limiting: 5 tentativas → 15min lockout
- Token armazenado em localStorage (frontend)

### Autorização

- `@roles_required("admin")` decorator
- `_scoped_user()` para validar company_id
- Nunca confiar em company_id do frontend

### Validação

- Todos os inputs validados no endpoint
- Type coercion + range checks
- Parameterized queries (SQLAlchemy previne SQL injection)

### Webhook

- Signature verification (Resend/payment provider)
- Idempotency keys (evita double-charge)
- Timestamp validation

### Segredos

- API keys em environment variables
- `.env` no .gitignore
- Nunca commitar tokens ou passwords

### Proteção contra Ataques

- **XSS**: React auto-escapa valores
- **CSRF**: JWT não precisa de CSRF
- **Enumeration**: Password reset retorna mensagem genérica
- **Data leakage**: company_id sempre filtrado
- **Race conditions**: Advisory locks em créditos

---

## 8. Padrão de Investigação de Bug

Quando receber um bug, siga esta ordem:

### 1. Entender o sintoma

- Qual tela apresenta o erro?
- Qual ação do usuário causa?
- Qual mensagem no console ou backend?
- Erro sempre ou em casos específicos?
- Reproduzível?

### 2. Mapear o fluxo

```
Tela (React component)
  ↓
Hook (useEffect, useState)
  ↓
Service / API call
  ↓
Endpoint (Flask blueprint)
  ↓
Service (business logic)
  ↓
Model (SQLAlchemy)
  ↓
Database (PostgreSQL)
```

### 3. Encontrar a raiz

Classificar como:
- Bug frontend (componente, hook, estado)
- Bug backend (endpoint, service, validação)
- Bug payload (dados enviados incorretos)
- Bug schema (tipo não bate)
- Bug permissão (company_id, role)
- Bug banco (migration, foreign key)
- Bug cache (localStorage desatualizado)

### 4. Corrigir com menor impacto

- Preservar padrão existente
- Evitar gambiarra temporária
- Não quebrar outros módulos
- Incluir tratamento de erro
- Incluir validação

### 5. Validar

Testar:
- Fluxo feliz (happy path)
- Fluxo com erro
- Dados vazios
- Usuário sem permissão
- Reload da página
- Persistência real no banco

---

## 9. Padrão para Nova Feature

Seguir esta ordem:

1. **Entidade**: Definir model (Petition, ServiceOrder, etc)
2. **Banco**: Criar ou revisar tabela
3. **Migration**: Criar via `_create_X_table()` ou `ALTER TABLE`
4. **Schema**: Definir input/output tipos (Zod, DTO)
5. **Service**: Implementar regra de negócio
6. **Endpoint**: Criar rota Flask
7. **Hook Frontend**: Criar API wrapper
8. **Componente**: Criar tela/dialog/modal
9. **Integração**: Conectar form com API real
10. **Permissões**: Validar acesso (roles, company_id)
11. **Loading/Error**: Estados visuais
12. **Teste**: CRUD completo

---

## 10. Checklist de Integração Frontend + Backend

### Frontend
- [ ] Usa API real ou mock? se mock, usar API REAL IMEDIATAMENTE
- [ ] localStorage usado indevidamente?
- [ ] Form envia todos campos necessários?
- [ ] Payload bate com schema backend?
- [ ] Estado atualizado após criar/editar/excluir?
- [ ] Existe loading state?
- [ ] Existe error state?
- [ ] Feedback visual ao usuário?
- [ ] Validação Zod no form?

### Backend
- [ ] Endpoint existe?
- [ ] Método HTTP correto (GET/POST/PUT/DELETE)?
- [ ] Schema valida entrada?
- [ ] Service aplica regra de negócio?
- [ ] Banco persiste?
- [ ] Filtro por company_id?
- [ ] Validação de permissão?
- [ ] Tratamento de erro?
- [ ] Serialização de resposta correta?
- [ ] Testes Unitários Passaram ?
### Banco
- [ ] Tabela existe?
- [ ] Campos batem com frontend?
- [ ] Constraints necessárias existem?
- [ ] Migration existe?
- [ ] Relacionamento correto?
- [ ] Soft delete ou hard delete definido?
- [ ] company_id presente (se multitenant)?

---

## 11. Padrão de Multitenancy

**Sempre que projeto é multitenant**:

- Toda entidade de negócio → `company_id`
- Toda query → filtra pelo tenant
- **Nunca** aceitar `company_id` livremente do frontend
- Usuário acessa apenas dados da organização
- Admin global ≠ admin da empresa
- Testar sempre: usuário A consegue ver dados de usuário B?

---

## 12. Regras de CRUD

Todo CRUD deve ter:

- [x] Create
- [x] Read / List
- [x] Update
- [x] Delete ou Soft Delete
- [x] Validação de campos obrigatórios
- [x] Tratamento de erro
- [x] Feedback visual
- [x] Proteção por permissão
- [x] Persistência real no banco
- [x] Atualização da UI após operação

**Evitar CRUD falso** baseado em:
- Mock fixo
- Array local
- localStorage
- Dados hardcoded

---

## 13. Checklist Final Antes de Mergear

- [ ] Projeto compila (npm run build, pytest)
- [ ] Sem erro de TypeScript (tsc --noEmit)
- [ ] Sem erro no console (dev tools)
- [ ] Sem endpoint quebrado
- [ ] Banco persiste dados
- [ ] Frontend reflete dados reais
- [ ] Permissões continuam funcionando
- [ ] company_id protegido (multitenant)
- [ ] Loading/error/success states existem
- [ ] Nenhum outro módulo quebrou
- [ ] Solução segue padrão do projeto
- [ ] Testes passam (pytest, vitest)
- [ ] Código reviewável (sem gambiarra)

---

## 14. Comandos Úteis

### Frontend

```bash
# Install & run
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Build para prod
npm run preview      # Test build localmente
npm run lint         # ESLint
npm run type-check   # TypeScript compiler

# Testing
npm test             # Vitest
npm run test:ui      # Vitest UI
```

### Backend

```bash
# Setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run
python run.py        # Dev server (http://localhost:5000)

# Testing & linting
pytest backend/tests/
pylint app/
```

### Database

```bash
# Inspect
docker exec peticiona-servicos-juridicos-db psql -U legalcraft_admin -d legal_craft_desk -c "SELECT * FROM users;"

# Backup
docker exec peticiona-servicos-juridicos-db pg_dump -U legalcraft_admin legal_craft_desk > backup.sql

# Restore
docker exec -i peticiona-servicos-juridicos-db psql -U legalcraft_admin legal_craft_desk < backup.sql
```

### Docker

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Full rebuild
docker compose down -v && docker image rm -f peticiona-backend peticiona-frontend && docker compose up -d --build

# Logs
docker compose logs -f backend   # Backend logs
docker compose logs -f frontend  # Frontend logs
docker compose logs -f db        # Database logs
```

---

## 15. Contatos e Documentação

- **Código**: Comentários explicam WHY, não WHAT
- **Docstrings**: Para funções complexas
- **Types**: TypeScript + Zod garantem contrato
- **Tests**: Validam comportamento esperado
- **Git commits**: Descrevem mudança + motivo
- **PR**: Explica contexto + testes

---

## 16. Regras de Ouro

1. **Sempre ler código existente** antes de sugerir mudanças
2. **Evitar soluções paralelas** se já existe padrão
3. **Não substituir arquitetura** sem justificar
4. **Não criar mock** se backend real existe
5. **Não deixar dados em localStorage** quando deveriam estar no banco
6. **Não alterar regras de autenticação** sem revisar impacto
7. **Não remover validações** sem entender regra de negócio
8. **Não criar endpoint** sem schema claro
9. **Não criar tela** sem conectar com API real
10. **Não finalizar tarefa** sem checklist de validação
11. **(docker compose down -v NUNCA USAR **
---

**Última atualização**: 2 de junho, 2026  
**Versão**: 1.0 (Prático para IA)  
**Mantido por**: André Kaique
