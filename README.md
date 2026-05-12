# Peticiona Servicos Juridicos

Aplicacao full stack para operacao de servicos juridicos com arquitetura `backend-first`.

O projeto foi reorganizado em pastas separadas para facilitar manutencao, seguranca e evolucao:

- `frontend`: interface em `Next.js 16`
- `backend`: API em `Flask`
- `infra`: suporte de infraestrutura e banco
- `docs`: auditoria do frontend original e decisoes de seguranca

## Principios do projeto

- `OWASP em primeiro lugar`: validacoes, regras de negocio e respostas seguras ficam no backend
- `Backend em primeiro lugar`: calculos, formatacoes operacionais, split payment, dashboard e upload sao responsabilidade da API
- `Frontend so exibe`: a interface coleta entradas, envia payloads e renderiza respostas do backend

## Stack

- `Next.js 16.2.4`
- `Flask 3.1.3`
- `PostgreSQL 16`
- `Docker Compose`

## Estrutura

```text
.
├── backend/
│   └── app/
│       ├── bootstrap/
│       ├── core/
│       ├── models/
│       ├── modules/
│       └── uploads/
├── docs/
├── frontend/
│   └── src/
│       ├── app/
│       ├── features/
│       └── shared/
└── infra/
```

### Organizacao backend

- `core`: configuracao, extensoes, seguranca e erros compartilhados
- `bootstrap`: seed e inicializacao de dados
- `models`: modelos do banco separados por responsabilidade
- `modules`: cada dominio com sua propria pasta (`auth`, `client_area`, `content`, `dashboard`, `health`, `split_payment`)

Dentro de cada modulo backend:

- `routes.py`: entrada HTTP
- `schemas.py`: validacao do payload
- `service.py`: regra de negocio

### Organizacao frontend

- `app`: rotas do Next.js
- `features`: componentes por contexto de negocio
- `shared`: layout, cliente HTTP e tipos compartilhados

Documentacao completa da arquitetura:

- [Arquitetura e convencoes de pastas](docs/architecture.md)

## Variaveis de ambiente

O arquivo `.env` local foi gerado com credenciais fortes.

O template versionado esta em [`.env.example`](.env.example).

Principais variaveis:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`
- `DATABASE_URL`
- `FLASK_SECRET_KEY`
- `PASSWORD_SALT`
- `CORS_ALLOWED_ORIGINS`

## Subir com Docker

```bash
docker compose up -d --build
```

Servicos:

- frontend: `http://localhost:3000`
- backend: `http://localhost:5000/api/health`
- postgres: `localhost:15432`

Para parar sem apagar os containers:

```bash
docker compose stop
```

## Desenvolvimento local

Backend:

```bash
python3 backend/run.py
```

Frontend:

```bash
cd frontend
npm run dev
```

Banco isolado:

```bash
make db-up
```

Se quiser validar o backend sem PostgreSQL, use SQLite temporariamente:

```bash
DATABASE_URL=sqlite:////tmp/legal-craft-desk.sqlite3 python3 backend/run.py
```

## Seguranca

Medidas aplicadas no backend:

- validacao de payloads no Flask
- forca de senha e confirmacao no backend
- rate limit basico para login e cadastro
- headers de seguranca
- CORS com allowlist
- upload com allowlist de extensoes, limite de tamanho e nome higienizado
- dashboard e calculos servidos pela API

Documentacao complementar:

- [Arquitetura e convencoes](docs/architecture.md)
- [Auditoria do frontend original](docs/frontend-audit.md)
- [Decisoes de seguranca](docs/security.md)

## Referencia visual

O layout foi migrado a partir do frontend original:

- `https://github.com/AndrekaiqueDevjunior/legal-craft-desk`
