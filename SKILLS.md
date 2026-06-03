# Peticiona: Technical Skills & Architecture Guide

## 🏗️ Project Overview

**Peticiona** é uma plataforma SaaS para gestão de serviços jurídicos sob demanda. Advogados podem contratar petições, pareceres e consultoria elaboradas por especialistas, com prazos previsíveis e custo transparente.

- **Type**: Legal SaaS Platform
- **Stack**: Flask (Python) + React (TypeScript) + PostgreSQL
- **Deployment**: Docker + Nginx + Ubuntu 24.04
- **Scale**: Multi-tenant (company_id scoping)
- **Auth**: JWT + Role-based access control (admin/staff/client)

---

## 🎯 Core Technical Skills

### Backend Architecture (97 Python files)

#### 1. **Flask Framework & Modular Design**
- **Pattern**: Flask blueprints + centralized extensions (`app/core/extensions.py`)
- **Structure**:
  ```
  backend/app/
  ├── modules/           # Feature-based blueprints
  │   ├── auth/
  │   ├── admin/
  │   ├── client/
  │   ├── me/
  │   ├── content/
  │   └── payments/
  ├── services/          # Business logic layer
  ├── models/            # SQLAlchemy ORM
  ├── core/              # Cross-cutting concerns
  ├── domain/            # Business rules
  ├── bootstrap/         # Runtime migrations
  └── permissions/       # Access control
  ```

**Key Files**:
- `app/__init__.py`: Application factory with `create_app()` pattern
- `app/core/extensions.py`: db, mail, cache initialization
- `gunicorn.conf.py`: Production server configuration with gevent workers
- `config.py`: Environment-aware settings (dev/test/production)

**Skills**: 
- ✅ Modular blueprint architecture
- ✅ Application factory pattern
- ✅ WSGI server tuning (gevent workers, socket buffering)
- ✅ Request/response lifecycle hooks

---

#### 2. **Database Layer & ORM Mastery**

**SQLAlchemy Models** (`app/models/`):
- **Inheritance**: Single-table inheritance (users.role VARCHAR field)
- **Relationships**: Complex multi-level associations
  - User → ServiceOrder → Petition
  - User → CreditTransaction (polymorphic type system)
  - Company scoping via foreign keys
  
**Advanced Patterns**:

a) **Runtime Migrations** (`app/bootstrap/migrations.py`):
   - Zero-downtime DDL (ALTER TABLE with IF EXISTS checks)
   - Concurrent migration locking (PostgreSQL advisory locks)
   - Backfill data migrations
   - Idempotent operations
   
   ```python
   _execute("SELECT pg_advisory_xact_lock(784231337)")  # Single-writer gate
   ```

b) **Scoped Queries** (`app/domain/permissions.py`):
   - User-aware filtering via `scoped_query(Model, user)`
   - Prevents cross-tenant data leakage
   - Multi-company safety net

c) **Credit Transactions System**:
   - Atomic debits with advisory locks (prevents race conditions)
   - Immutable ledger with type-based semantics ('in'/'out')
   - Support for two kinds: 'common' (credits) + 'legacy_cents' (deprecated)
   - Idempotency keys prevent duplicate charges

**Key Files**:
- `app/models/__init__.py`: All ORM models
- `app/services/credit_ledger.py`: Credit arithmetic with race-condition safety
- `app/bootstrap/migrations.py`: 800+ lines of zero-downtime migrations

**Skills**:
- ✅ SQLAlchemy relationships (ForeignKey, lazy loading strategies)
- ✅ PostgreSQL advisory locks for distributed safety
- ✅ Transaction isolation levels
- ✅ Zero-downtime schema changes
- ✅ Idempotent operations pattern

---

#### 3. **Authentication & Security**

**JWT Authentication** (`app/modules/auth/`):
- Token generation with user ID + expiration
- Password hashing: Werkzeug scrypt (adaptive, salted)
- Rate limiting on login attempts (brute-force protection)
- Account lockout after N failed attempts

**Authorization Layer** (`app/domain/permissions.py`):
```python
@roles_required("admin")  # Decorator-based enforcement
def update_client(actor, user_id, payload):
    client = _scoped_user(actor, user_id, role="client")  # Tenant boundary
    # safe to operate on client (verified ownership)
```

**Password Reset Flow** (`app/services/password_reset_service.py`):
- Token serialization with signature (prevents tampering)
- Enumeration protection (same response for existing/non-existing emails)
- Privileged account blocking (admin can't self-reset)
- Email delivery via Resend API + SMTP fallback

**Key Files**:
- `app/modules/auth/routes.py`: Login/register endpoints
- `app/services/password_reset_service.py`: Secure reset flow
- `app/core/security.py`: Password hashing + validation rules

**Skills**:
- ✅ JWT token design (claims, expiration, signature)
- ✅ Adaptive password hashing (scrypt vs bcrypt)
- ✅ Rate limiting strategies
- ✅ Enumeration attack prevention
- ✅ Privileged account hardening

---

#### 4. **Business Logic & Domain Services**

**Petition Service** (`app/services/petition_service.py`):
- Creates petition + auto-creates linked ServiceOrder
- Auto-calculates deadline via `calcular_prazo_entrega()`
- Debits 1 credit immediately (reserve before payment)
- Handles express_upgrade flag
- Returns serialized petition + order

**Deadline Calculator** (`app/services/prazos_service.py`):
```python
def calcular_prazo_entrega(modalidade: str, inicio: datetime) -> datetime:
    """Add business days, respecting Brazilian holidays + Easter"""
    # Implements:
    # - Fixed holidays (Natal, Independência, etc)
    # - Moveable holidays (Carnaval, Sexta Santa via Easter)
    # - Easter via Meeus/Jones/Butcher algorithm
    # - Ignores weekends
```

**Checkout Service** (`app/services/checkout_service.py`):
- Processes payment via webhook
- Confirms express upgrade (+R$40 as add-on)
- Validates `expected_amount` against base + upgrades
- Updates ServiceOrder status
- Triggers credit debit

**Client Area Service** (`app/services/client_area_service.py`):
- Creates service orders from catalog
- Manages client petition workflow
- Handles order to petition linking

**Admin Service** (`app/services/admin_service.py`):
- Admin-only order creation (bypass payments)
- Serializes orders with computed fields
- Deadline auto-fill (new)
- Client management

**Key Files**:
- `app/services/petition_service.py` (230 lines)
- `app/services/prazos_service.py` (140 lines)
- `app/services/checkout_service.py` (400 lines)
- `app/services/admin_service.py` (850 lines)

**Skills**:
- ✅ Complex transactional workflows
- ✅ Date arithmetic with business rules
- ✅ Webhook payment processing
- ✅ Atomic operation sequencing
- ✅ Enum + choice fields management

---

#### 5. **Settings & Configuration Management**

**Runtime Configuration** (`app/services/settings_service.py`):
- Stores global platform settings in database (PlatformSettings table)
- Key-value pattern with fallback to environment variables
- Used for: contact info (email, WhatsApp), branding

**Payment Configuration** (`app/services/payment_providers.py`):
- Resend API integration (primary email provider)
- SMTP fallback
- Rate limiting awareness

**Key Files**:
- `app/services/settings_service.py`
- `backend/config.py`

**Skills**:
- ✅ 12-factor app configuration
- ✅ Environment variable hierarchies
- ✅ Database-backed settings
- ✅ Provider abstraction (Resend + SMTP)

---

#### 6. **Error Handling & Validation**

**Custom Exception Hierarchy** (`app/core/errors.py`):
```python
class AppError(Exception): pass
class ValidationError(AppError): pass
class PermissionDenied(AppError): pass
class AuthenticationRequired(AppError): pass
```

**Request Validation Pattern**:
```python
def create_order(payload):
    validated = _validate_order_payload(payload)  # Early validation
    if errors:
        raise ValidationError("...")  # Centralized error response
```

**Error Response Formatting** (`app/modules/*/routes.py`):
```python
@app.errorhandler(ValidationError)
def handle_validation_error(e):
    return jsonify({"error": "VALIDATION_ERROR", "message": str(e)}), 400
```

**Skills**:
- ✅ Custom exception hierarchies
- ✅ Validation at system boundaries
- ✅ Centralized error handlers
- ✅ User-friendly error messages

---

### Frontend Architecture (134 TypeScript files)

#### 1. **React + TypeScript Modern Stack**

**Tech Stack**:
- React 18+ with hooks (no class components)
- TypeScript strict mode
- Vite (fast HMR, ESM-first)
- React Router v6 (nested routes, loaders)
- TailwindCSS + shadcn/ui (component library)
- React Query (data fetching, caching)

**Structure**:
```
frontend/src/
├── pages/              # Route-level components
│   ├── admin/          # Admin dashboard
│   ├── client/         # Client area
│   ├── Index.tsx       # Landing page
│   ├── Auth.tsx        # Login/register
│   └── Checkout.tsx    # Payment flow
├── components/
│   ├── admin/          # Admin-specific UI
│   ├── client/         # Client-specific UI
│   ├── landing/        # Marketing UI
│   └── ui/             # Primitives (Button, Card, etc)
├── lib/
│   ├── api.ts          # API client
│   ├── auth.ts         # Auth context
│   ├── contactInfo.ts  # Global contact state
│   ├── prazos.ts       # Business day calculator (mirror of backend)
│   └── hooks.ts        # Custom hooks
├── hooks/              # React hooks
└── App.tsx             # Router + providers
```

**Key Files**:
- `src/App.tsx`: Route definitions (nested layouts)
- `src/lib/api.ts`: Type-safe API client (670 lines)
- `src/main.tsx`: App initialization

**Skills**:
- ✅ React hooks (useState, useEffect, useContext, useReducer)
- ✅ TypeScript strict typing (no 'any')
- ✅ Component composition patterns
- ✅ Custom hooks for logic reuse
- ✅ Suspense + Error boundaries

---

#### 2. **Type-Safe API Client**

**File**: `frontend/src/lib/api.ts` (670 lines)

**Pattern**: Namespace-based API client with full TypeScript support

```typescript
export const api = {
  auth: {
    login: (email, password) => request<AuthResponse>("/auth/login", ...),
    register: (payload) => request<AuthResponse>("/auth/register", ...),
    requestPasswordReset: (email) => request<{}>("/password-reset/request", ...),
  },
  admin: {
    settings: {
      contact: {
        get: () => request<ContactInfo>("/admin/settings/contact"),
        update: (data) => request<ContactInfo>("/admin/settings/contact", ...),
      },
    },
    orders: {
      list: () => request<OrderList>("/admin/orders"),
      create: (payload) => request<Order>("/admin/orders", {method: "POST", ...}),
    },
  },
  client: {
    orders: {
      list: () => request<OrderList>("/client/orders"),
    },
  },
};
```

**Advanced Features**:
- Generic `<T>` return typing
- Automatic JWT injection via `Authorization` header
- Error handling with try/catch + custom error class
- URL construction with template strings
- Query parameters support

**Key Files**:
- `src/lib/api.ts`
- `src/lib/auth.ts`: Auth context provider

**Skills**:
- ✅ Namespace pattern for API organization
- ✅ Generic TypeScript for type safety
- ✅ Fetch API (no axios dependency)
- ✅ JWT token management
- ✅ Error propagation

---

#### 3. **Authentication & Authorization**

**Auth Context** (`src/lib/auth.ts`):
- Stores JWT token in localStorage
- Provides `useAuth()` hook for components
- Token injection in all API requests
- Login/logout state management

**Protected Routes** (`src/App.tsx`):
```typescript
<Route path="/admin" element={
  <ProtectedRoute requiredRole="admin">
    <AdminLayout />
  </ProtectedRoute>
} />
```

**Key Components**:
- `Auth.tsx`: Login/register page
- `ForgotPassword.tsx`: Password reset request
- `ResetPassword.tsx`: Token confirmation

**Skills**:
- ✅ JWT token lifecycle management
- ✅ Context API for global state
- ✅ Route protection patterns
- ✅ Secure credential handling

---

#### 4. **State Management**

**Patterns Used**:

a) **Context API** (for global state):
   - Auth context (user, token, login/logout)
   - Contact info context (email, WhatsApp)

b) **Local component state** (for UI):
   - Form fields (useState)
   - Modal visibility (useState)
   - Loading states (isLoading, isSaving)

c) **localStorage** (for persistence):
   - JWT token
   - Contact info (as fallback cache)

**No Redux**: Simple enough for context + localStorage

**Key Files**:
- `src/lib/auth.ts`: useAuth context
- `src/lib/contactInfo.ts`: useContactInfo context + localStorage sync

**Skills**:
- ✅ React Context for global state
- ✅ localStorage API for persistence
- ✅ State lifting patterns
- ✅ Avoiding prop drilling

---

#### 5. **Component Patterns**

**Form Components**:
- Controlled inputs with onChange handlers
- Validation on submit (not on every keystroke)
- Error message display
- Loading states on buttons

**Layout Components**:
- Sidebar navigation
- Header with auth status
- Footer with contact info + links
- Error boundary for crash handling

**Dialog/Modal Components**:
- shadcn Dialog wrapper
- Form validation before submission
- Loading states

**Key Components**:
- `AdminProfile.tsx`: Settings + contact update
- `AdminOrders.tsx`: Order list + details
- `Checkout.tsx`: Payment form
- `NewRequestDialog.tsx`: Create petition
- `HelpContactDialog.tsx`: Contact modal

**Skills**:
- ✅ Controlled vs uncontrolled components
- ✅ Form validation patterns
- ✅ Modal/dialog management
- ✅ Error boundaries
- ✅ Suspense boundaries

---

#### 6. **Business Logic Libraries**

**Prazos (Business Days Calculator)** (`src/lib/prazos.ts`):
- Mirrors backend calculation (feature parity)
- Calculates delivery deadlines
- Respects Brazilian holidays + Easter
- Used in checkout for deadline display

**Contact Info Management** (`src/lib/contactInfo.ts`):
- Fetches from API on mount
- Falls back to localStorage
- Dispatches CustomEvent for cross-tab sync
- useContactInfo hook for components

**Key Files**:
- `src/lib/prazos.ts` (mirror of backend prazos_service.py)
- `src/lib/contactInfo.ts`
- `src/hooks/use-toast.ts`: Toast notifications

**Skills**:
- ✅ Business logic mirroring (client-side confidence)
- ✅ Date calculations
- ✅ Custom Events for IPC
- ✅ Graceful fallbacks

---

#### 7. **UI Libraries & Styling**

**Component Library**: shadcn/ui
- Pre-built accessible components
- Built on Radix UI primitives
- Customizable via Tailwind

**Styling**: TailwindCSS
- Utility-first CSS
- Dark mode support
- Custom CSS variables

**Icons**: lucide-react
- SVG icons as React components

**Key Files**:
- `frontend/src/components/ui/`: Dialog, Button, Input, Card, etc
- `frontend/tailwind.config.ts`: Custom theme
- `frontend/vite.config.ts`: Asset optimization

**Skills**:
- ✅ TailwindCSS utility patterns
- ✅ Accessible component design
- ✅ CSS variables for theming
- ✅ Responsive design patterns

---

## 🔒 Security Architecture

### Backend Security

1. **Authentication**:
   - JWT with 1-hour expiration
   - Scrypt password hashing (adaptive, slowed against brute force)
   - Rate limiting on login (5 attempts → 15min lockout)

2. **Authorization**:
   - Role-based access control (@roles_required decorator)
   - Tenant scoping (company_id filter on all queries)
   - User-aware filtering (prevent cross-tenant access)

3. **Input Validation**:
   - All user inputs validated at endpoints
   - Type coercion + range checks
   - SQL injection prevention via parameterized queries (SQLAlchemy)

4. **Payment Security**:
   - `expected_amount` validation (prevents amount tampering)
   - Webhook signature verification (via Resend/payment provider)
   - Idempotency keys (prevent duplicate charges)

5. **Secrets Management**:
   - Environment variables for API keys
   - No credentials in code
   - `.env` file in .gitignore

**Files**:
- `app/core/security.py`
- `app/domain/permissions.py`
- `app/services/password_reset_service.py` (enumeration protection)

### Frontend Security

1. **XSS Prevention**:
   - React auto-escapes JSX values
   - No `dangerouslySetInnerHTML` usage

2. **CSRF Prevention**:
   - No form-based submissions (API + JWT)
   - Cookies not used for auth

3. **Secure Credential Storage**:
   - JWT stored in localStorage (not accessible to JavaScript attacks due to origin isolation)
   - No storing passwords client-side

4. **Content Security**:
   - Dependencies scanned (package-lock.json)
   - No inline scripts

---

## 🚀 Deployment & DevOps

### Docker & Containerization

**Docker Compose** (`docker-compose.yml`):
```yaml
services:
  db:              # PostgreSQL 16
  backend:         # Flask + gunicorn
  frontend:        # Nginx + React SPA
```

**Images**:
- `postgres:16-alpine` (5MB base)
- Custom `peticiona-backend` (multi-stage build)
- Custom `peticiona-frontend` (Node build + Nginx serve)

**Key Files**:
- `backend/Dockerfile`: Python 3.12-slim + gunicorn
- `frontend/Dockerfile`: Node build → Nginx
- `docker-compose.yml`
- `infra/postgres/init/`: Database initialization scripts

**Skills**:
- ✅ Multi-stage Docker builds
- ✅ Docker Compose orchestration
- ✅ Image optimization (alpine, layering)
- ✅ Volume management (data persistence)
- ✅ Health checks (service readiness)

### Nginx Reverse Proxy

**File**: `/etc/nginx/sites-available/peticiona`

```nginx
server {
  listen 443 ssl http2;
  server_name peticiona.app.br;
  
  location /api {
    proxy_pass http://localhost:5000;
  }
  location / {
    proxy_pass http://localhost:3000;
  }
}
```

**Features**:
- SSL termination (Let's Encrypt)
- Reverse proxy routing
- Request forwarding

**Skills**:
- ✅ Nginx configuration
- ✅ SSL/TLS setup
- ✅ Reverse proxy patterns
- ✅ Static file serving optimization

### Database Management

**PostgreSQL 16**:
- Advanced features: advisory locks, JSONB, window functions
- Transactions with SERIALIZABLE isolation

**Migrations** (runtime):
- Zero-downtime schema changes
- Concurrent operation safety
- Idempotent backfills

**Backups**:
- Docker volume for data persistence
- Manual `pg_dump` for backups

**Skills**:
- ✅ PostgreSQL administration
- ✅ Index optimization (EXPLAIN ANALYZE)
- ✅ Transaction management
- ✅ Backup/restore procedures

---

## 📊 Advanced Patterns

### 1. **Idempotency Pattern**

Used in:
- Credit debits (`idempotency_key` in credit_transactions)
- Password reset requests (one-time token)
- Order creation (reference-based deduplication)

```python
idempotency_key = f"order-debit-{order.reference}"
debit(..., idempotency_key=idempotency_key)
# If called twice with same key, second call is no-op
```

### 2. **Tenant Scoping Pattern**

All models have `company_id`:
```python
scoped_query(ServiceOrder, user)  # Filters by user.company_id
```

Prevents data leakage in multi-tenant SaaS.

### 3. **Webhook Security Pattern**

Payment webhooks verified via:
- Signature validation (HMAC)
- Idempotency keys (prevent replays)
- Timestamp validation (prevent old replays)

### 4. **Enumeration Attack Prevention**

Password reset endpoint returns same response whether email exists or not:
```python
return {"message": "Se o e-mail estiver cadastrado, enviaremos..."}
# No difference between found/not-found
```

### 5. **Runtime Feature Toggles**

Global settings in database (PlatformSettings):
- Contact info (email, phone)
- Feature flags (future capability)
- Branding (logo, colors)

### 6. **Advisory Locking for Distributed Safety**

Credit debits use PostgreSQL locks:
```sql
SELECT pg_advisory_xact_lock(user_id)  -- Single writer per user
```

Prevents double-spending in concurrent requests.

---

## 🔧 Development Workflow

### Local Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py  # Runs on http://localhost:5000

# Frontend
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173 (Vite)
```

### Testing

**Backend**:
```bash
pytest backend/tests/  # Unit + integration tests
```

**Frontend**:
```bash
npm test  # Vitest
npm run build  # Build verification
```

### Linting & Type Checking

**Backend**:
```bash
pylint app/
mypy app/  # Type checking (optional)
```

**Frontend**:
```bash
npx eslint src/  # Linting
npm run type-check  # TypeScript compiler
```

---

## 📚 Key Concepts

### Business Domain

**Credits System**:
- 1 credit = 1 service request
- Different plans grant different monthly credits
- Ledger-based tracking (immutable transactions)
- Support for different credit "kinds" (common, legacy)

**Service Types**:
- Avulso (3-day delivery, R$180)
- Essencial (3-day delivery, R$160 + plan)
- Profissional (3-day delivery, R$200 + plan)
- Estratégico (2-day delivery, R$300 + plan)

**Express Upgrade**:
- +R$40 add-on to any service
- Reduces delivery time
- Applied via checkout (not separate service)

**Prazos (Deadlines)**:
- Calculated in business days (not calendar days)
- Respect Brazilian holidays (16 fixed + Easter moveable)
- Auto-calculated at order creation

---

## 🎓 Learning Resources

### Concepts to Master

1. **Flask**:
   - Blueprints + modular design
   - Request/response cycle
   - Error handling

2. **SQLAlchemy**:
   - ORM relationships
   - Query building
   - Transaction management

3. **PostgreSQL**:
   - ACID properties
   - Advisory locks
   - Window functions

4. **React**:
   - Hooks lifecycle
   - Context API
   - Component composition

5. **TypeScript**:
   - Generics
   - Discriminated unions
   - Strict mode

6. **Security**:
   - JWT tokens
   - Password hashing
   - OWASP Top 10

---

## 🚀 Performance Considerations

### Backend

- **Connection pooling**: SQLAlchemy connection pool
- **Query optimization**: Use SELECT * sparingly, index frequently queried columns
- **Caching**: Future opportunity (Redis for session/rate limit state)
- **Rate limiting**: Current: memory-based, future: Redis-backed

### Frontend

- **Code splitting**: Vite automatic chunk splitting
- **Lazy loading**: React.lazy for route-level components
- **Image optimization**: Vite automatically optimizes images
- **Bundle analysis**: `npm run build --analyze`

---

## 📝 Code Quality Standards

### Python

- Follow PEP 8 (enforced via pylint)
- Type hints where beneficial
- Docstrings for complex functions
- No bare except clauses

### TypeScript

- Strict mode (no implicit any)
- Exhaustive switch statements
- Typed props in React components
- No 'any' types

### Testing

- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical flows (future)
- Aim for >80% coverage

---

## 🔮 Future Enhancement Opportunities

1. **Caching Layer**: Redis for session state, rate limit tracking
2. **Search**: Elasticsearch for order search
3. **Real-time Updates**: WebSockets for order status
4. **API Documentation**: OpenAPI/Swagger
5. **Analytics**: Event tracking, business metrics
6. **Monitoring**: Sentry for error tracking, Datadog for metrics
7. **A/B Testing**: Feature flag system
8. **Internationalization**: Multi-language support (i18n)

---

## 📖 File Navigation Quick Reference

### Backend Most Important Files

| File | Purpose | Lines |
|------|---------|-------|
| `app/__init__.py` | App factory | 50 |
| `app/models/__init__.py` | All ORM models | 600+ |
| `app/services/petition_service.py` | Petition logic | 230 |
| `app/services/checkout_service.py` | Payment processing | 400 |
| `app/services/admin_service.py` | Admin operations | 850 |
| `app/services/credit_ledger.py` | Credit system | 200 |
| `app/bootstrap/migrations.py` | Schema migrations | 800 |
| `app/modules/auth/routes.py` | Auth endpoints | 100 |

### Frontend Most Important Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/App.tsx` | Router + providers | 100 |
| `src/lib/api.ts` | API client | 670 |
| `src/lib/auth.ts` | Auth context | 80 |
| `src/pages/admin/AdminProfile.tsx` | Admin settings | 250 |
| `src/pages/Checkout.tsx` | Payment UI | 300 |
| `src/components/client/NewRequestDialog.tsx` | Create petition | 200 |

---

**Last Updated**: June 2, 2026  
**Version**: 1.0 (Advanced Technical Skills Guide)
