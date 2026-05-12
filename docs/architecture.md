# Arquitetura

Este projeto foi organizado para crescer sem espalhar regra de negocio entre frontend e backend.

## Principio central

- `backend-first`: toda regra de negocio, validacao critica, calculo e decisao operacional ficam no Flask
- `frontend-only-display`: o Next.js coleta entradas, chama a API e renderiza respostas

## Backend

Estrutura:

```text
backend/app/
├── bootstrap/
├── core/
├── models/
├── modules/
└── uploads/
```

### `core/`

Responsavel por infraestrutura compartilhada da aplicacao.

- `config.py`: leitura de ambiente e configuracao global
- `extensions.py`: extensoes como SQLAlchemy
- `security.py`: headers e politicas de seguranca
- `errors.py`: erros compartilhados da camada HTTP e validacao

### `bootstrap/`

Responsavel por inicializacao controlada.

- `seed.py`: dados iniciais seguros e previsiveis

### `models/`

Separado por agregado de dominio, para evitar um arquivo unico crescendo sem controle.

- `users.py`
- `plans.py`
- `catalog.py`
- `orders.py`
- `documents.py`

### `modules/`

Cada dominio deve ter sua propria pasta.

Estrutura padrao:

```text
modules/<dominio>/
├── __init__.py
├── routes.py
├── schemas.py
└── service.py
```

Regras:

- `routes.py` nao calcula regra de negocio
- `schemas.py` valida entrada
- `service.py` executa o caso de uso
- se um modulo nao precisa de `schemas.py`, isso deve ser excecao e nao regra

## Frontend

Estrutura:

```text
frontend/src/
├── app/
├── features/
└── shared/
```

### `app/`

Contem apenas as rotas do Next.js e a composicao da pagina.

### `features/`

Contem componentes organizados por contexto funcional.

- `auth`
- `client-area`
- `marketing`
- `split-payment`

Regras:

- componentes de feature nao devem conter regra critica de negocio
- componentes podem manter estado visual e formularios
- calculos, validacoes finais e valores oficiais devem vir da API

### `shared/`

Contem o que realmente e compartilhado.

- `components/layout`
- `lib/api.ts`
- `lib/types.ts`

## Convencoes para escalar

- qualquer nova regra de negocio entra primeiro no backend
- qualquer novo endpoint deve nascer dentro de um modulo de dominio
- qualquer novo componente reutilizavel geral vai para `shared`
- qualquer componente especifico de fluxo vai para `features/<dominio>`
- evitar arquivos “misc”, “helpers” genericos ou “utils” sem contexto claro

## Fluxo recomendado para novas features

1. criar ou escolher o modulo backend responsavel
2. definir schema de entrada
3. implementar service
4. expor route
5. consumir no frontend pela rota `app/`
6. renderizar com componentes em `features/`

## Objetivo desta organizacao

Reduzir:

- bug por responsabilidade duplicada
- regra escondida no frontend
- dificuldade de onboarding
- manutencao dolorosa em arquivos grandes e misturados
