# SaaS Production Readiness & Deploy Auditor

## Objetivo

Validar se o Peticiona está pronto para produção: Docker Compose, nginx, variáveis de ambiente,
segredos, CORS/headers, banco PostgreSQL, migrações, logs e healthcheck — sem segredo exposto e
sem configuração de desenvolvimento vazando para produção.

## Quando usar

- Antes de um deploy ou release.
- Ao alterar `docker-compose.yml`, `nginx.conf`, `Dockerfile`, `.env*` ou config de boot.
- Ao revisar variáveis novas e prontidão de infra.

## Quando não usar

- Para auditoria de código de aplicação em si (use `security-audit`/`backend-api`).
- Para modelagem de banco (use `database-modeling`).

## Responsabilidades

- Conferir que toda variável usada está em `.env.example` e setada no ambiente alvo.
- Garantir `FLASK_DEBUG=0`/sem debug em produção; CSP/HSTS ativos; CORS allowlist real.
- Validar segredos fortes (`FLASK_SECRET_KEY`, `JWT_SECRET`, `PASSWORD_SALT`) e não commitados.
- Conferir Docker (build, portas, volumes, healthcheck) e nginx (proxy, limites, TLS).
- Validar PostgreSQL em produção (não SQLite) e migrações idempotentes no boot.
- Conferir rate limit ligado, logs configurados (`LOG_LEVEL`/`LOG_FILE`).

## Checklist operacional

**Antes**
- [ ] Diferença entre `.env`, `.env.example`, `.env.vps` revisada.
- [ ] Ambiente alvo identificado (VPS, portas, domínio, TLS).

**Durante**
- [ ] `DEBUG`/`FLASK_DEBUG` desligado em produção; headers CSP/HSTS aplicados.
- [ ] `CORS_ALLOWED_ORIGINS` com domínios reais (sem `*`, sem localhost).
- [ ] Segredos fortes e ausentes do versionamento; `DATABASE_URL` → PostgreSQL.
- [ ] `docker compose up -d --build` sobe frontend/backend/postgres; `/api/health` responde.
- [ ] nginx faz proxy correto, limita corpo de upload, serve TLS.
- [ ] Migrações de runtime idempotentes; seed seguro (sem usuário fake de produção).

**Depois**
- [ ] Smoke test pós-deploy (login, criar pedido, checkout sandbox, webhook).
- [ ] Logs sem segredo; rate limit ativo; backup de banco previsto.

## Entradas esperadas

- Ambiente alvo, domínio, e o estado atual de `.env`/infra.

## Saídas esperadas

- Checklist de prontidão preenchido + lista de bloqueadores de deploy.
- Confirmação de smoke test e healthcheck.

## Arquivos comuns para revisar

- `docker-compose.yml`, `Dockerfile`, `frontend/Dockerfile`, `nginx.conf`, `Makefile`
- `.env.example`, `.env.vps`, `backend/app/core/config.py`, `backend/app/__init__.py`
- `DEPLOY_CHECKLIST.md`, `SMOKE_TEST_RESULTS.md`, `docs/predeploy-validation-*.md`

## Boas práticas

- Paridade dev/prod via variáveis, não via código.
- Healthcheck e logs estruturados; rotação de log.
- Segredos por ambiente; rotação periódica.
- Backup e plano de rollback antes do deploy.

## Erros comuns

- `DEBUG=True`/stack trace em produção.
- CORS `*` ou localhost em produção.
- SQLite em produção por engano.
- Variável usada no código mas ausente do `.env.example`.
- Segredo fraco ou commitado.

## Regras obrigatórias

- Sem debug e sem segredo exposto em produção.
- CORS allowlist e headers de segurança obrigatórios.
- PostgreSQL em produção; migrações idempotentes.
- Smoke test + healthcheck antes de considerar deploy concluído.

## Exemplo de prompt usando esta Skill

> "Use a skill `production-readiness`: revise `docker-compose.yml`, `nginx.conf` e `config.py`
> para deploy na VPS. Liste os bloqueadores (debug ligado, CORS, segredo, SQLite) e produza um
> checklist final de go/no-go com smoke test pós-deploy."
