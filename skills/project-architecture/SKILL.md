# Backend-First Architecture Guardian

## Objetivo

Garantir que qualquer mudança respeite a arquitetura **backend-first / frontend-only-display**
do Peticiona e que o código novo nasça na **camada e pasta corretas**, evitando regra de
negócio escondida no frontend e arquivos genéricos sem responsabilidade.

## Quando usar

- Ao decidir **onde** colocar um arquivo/código novo (rota, service, model, componente, lib).
- Ao iniciar uma feature e definir o caminho `route → schema → service → model → frontend`.
- Em revisão de PR para checar violações de camada.
- Quando aparecer cálculo, preço, regra ou decisão dentro do frontend.

## Quando não usar

- Para detalhes finos de implementação de um endpoint (use `backend-api`).
- Para auditoria de segurança específica (use `security-audit`).
- Para modelagem de tabela (use `database-modeling`).

## Responsabilidades

- Validar o fluxo `Frontend → route → schema → service → model → PostgreSQL`.
- Garantir que `routes.py` não contenha regra de negócio nem SQL.
- Garantir que regra/valor oficial esteja no backend e não no React.
- Confirmar que features novas vivem em `modules/<dominio>/` e `frontend/src/{pages,components,lib}`.
- Rejeitar arquivos `utils/helpers/misc` genéricos e código na raiz legada.

## Checklist operacional

**Antes**
- [ ] Identifiquei o domínio da mudança e o módulo backend responsável.
- [ ] Confirmei que o frontend canônico é `frontend/` (não a raiz legada).

**Durante**
- [ ] Regra de negócio → `services/`; validação → `schemas.py`; HTTP → `routes.py`.
- [ ] Nenhum cálculo de valor oficial/saldo/preço no React.
- [ ] Componente específico de fluxo em `components/<contexto>`; reutilizável em `components/shared` ou `ui`.
- [ ] Chamada de API isolada em `frontend/src/lib/*.ts` (não `fetch` solto em página).

**Depois**
- [ ] O fluxo é real ponta a ponta (sem mock).
- [ ] Nenhum arquivo genérico criado; nomes refletem o domínio.

## Entradas esperadas

- Descrição da feature/bug e o domínio afetado (pedidos, créditos, auth, planos...).
- Caminho atual dos arquivos envolvidos.

## Saídas esperadas

- Decisão clara de **onde** cada parte do código deve morar.
- Lista de arquivos a criar/editar por camada.
- Apontamento de violações de arquitetura, se houver.

## Arquivos comuns para revisar

- `backend/app/__init__.py`, `backend/app/modules/<dominio>/{routes,schemas}.py`
- `backend/app/services/*.py`, `backend/app/domain/{permissions,plan_rules}.py`
- `frontend/src/pages/**`, `frontend/src/components/**`, `frontend/src/lib/*.ts`
- `AGENTS.md`, `docs/architecture.md`

## Boas práticas

- Uma responsabilidade por arquivo; módulos coesos por domínio.
- Service não conhece HTTP; route não conhece SQL.
- Tipos do frontend espelham contratos do backend (`lib/api.ts`).
- Preferir reuso de service existente a duplicar regra.

## Erros comuns

- Colocar regra/preço/saldo no React “para ir mais rápido”.
- Criar endpoint fora de um módulo de domínio.
- SQL ou `db.session` dentro de `routes.py`.
- Trabalhar no scaffold Vite da **raiz** em vez de `frontend/`.
- Criar `utils.ts`/`helpers.py` que viram lixeira.

## Regras obrigatórias

- Regra de negócio **sempre** no backend.
- Endpoint novo **sempre** dentro de `modules/<dominio>/`.
- `routes.py` **nunca** calcula regra nem acessa banco diretamente.
- Frontend **só exibe**: coleta, envia, renderiza.

## Exemplo de prompt usando esta Skill

> "Use a skill `project-architecture`: quero adicionar 'reenvio de petição corrigida'.
> Diga em quais arquivos (route/schema/service/model/frontend) isso deve entrar, sem
> escrever a implementação ainda — só o desenho das camadas e responsabilidades."
