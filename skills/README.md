# Skills — Peticiona

Cada skill é pequena, específica e operacional. Carregue o `SKILL.md` relevante e siga o
checklist. A fonte de verdade global é [`../AGENTS.md`](../AGENTS.md).

| Skill | Para que serve |
|---|---|
| [project-architecture](project-architecture/SKILL.md) | Onde colocar código; fluxo backend-first; camadas |
| [backend-api](backend-api/SKILL.md) | Criar/revisar endpoints Flask (route → schema → service → model) |
| [frontend-integration](frontend-integration/SKILL.md) | Conectar telas React à API real (TanStack Query) |
| [database-modeling](database-modeling/SKILL.md) | Models, índices e migrações PostgreSQL/SQLAlchemy |
| [auth-rbac](auth-rbac/SKILL.md) | JWT, roles (admin/staff/client) e escopo de dados |
| [credit-ledger-payments](credit-ledger-payments/SKILL.md) | Saldo, créditos, checkout, split, reembolso, idempotência |
| [external-integrations](external-integrations/SKILL.md) | Pagar.me, Resend, Nemotron e webhooks |
| [security-audit](security-audit/SKILL.md) | OWASP, headers, CORS, rate limit, upload seguro |
| [anti-mock-audit](anti-mock-audit/SKILL.md) | Caçar mock/fake/CRUD-visual/localStorage-como-banco |
| [bug-investigation](bug-investigation/SKILL.md) | Investigar bug até a causa raiz + regressão |
| [production-readiness](production-readiness/SKILL.md) | Docker, nginx, env, deploy, smoke test |
| [testing-quality](testing-quality/SKILL.md) | pytest + Vitest, foco em fluxos críticos |
| [documentation-architect](documentation-architect/SKILL.md) | Manter docs verdadeiras e alinhadas ao código |

## Combinações comuns

- **Nova feature de pagamento:** `backend-api` + `credit-ledger-payments` + `external-integrations` + `security-audit` + `testing-quality`
- **Auditoria de segurança:** `security-audit` + `auth-rbac` + `anti-mock-audit`
- **Bug financeiro:** `bug-investigation` + `credit-ledger-payments` + `testing-quality`
- **Preparar release:** `production-readiness` + `documentation-architect` + `testing-quality`
