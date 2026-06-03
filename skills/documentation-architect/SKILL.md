# Documentation Architect

## Objetivo

Manter a documentação do Peticiona **verdadeira e útil**, alinhada ao código real, corrigindo a
divergência atual (README/`docs/architecture.md` descrevem Next.js e `app/features/shared`,
mas o frontend real é Vite + React Router em `pages/components/lib`) e mantendo `AGENTS.md` e as
skills como fonte de verdade.

## Quando usar

- Após mudar arquitetura, stack, fluxo ou contrato de API.
- Ao detectar documentação que contradiz o código.
- Ao criar/atualizar `AGENTS.md`, `README.md`, `docs/*` ou um `SKILL.md`.
- Em onboarding, para garantir que a doc reflita a realidade.

## Quando não usar

- Para implementar a feature em si (documentar vem depois do código real).
- Para auditoria de segurança/financeiro (use as skills específicas).

## Responsabilidades

- Garantir que a doc descreva o sistema **como ele é** (não como era/seria).
- Corrigir o drift: frontend é **Vite + React 18 + React Router 6 + shadcn**, não Next.js.
- Refletir a estrutura real: `frontend/src/{pages,components,lib}` e backend
  `modules/<dominio>/{routes,schemas}` + `services/*` + `domain/*` + `models/*`.
- Manter `AGENTS.md` e `skills/*/SKILL.md` consistentes entre si.
- Documentar contratos de API, variáveis de ambiente e fluxos críticos.

## Checklist operacional

**Antes**
- [ ] Comparar a doc atual com o código real (estrutura, stack, fluxo).
- [ ] Listar afirmações falsas/desatualizadas.

**Durante**
- [ ] Corrigir stack/estrutura/fluxos para refletir a realidade.
- [ ] Atualizar `.env.example` se houver variável nova.
- [ ] Manter exemplos executáveis (comandos que realmente funcionam).
- [ ] Linkar skills e `AGENTS.md` onde fizer sentido.

**Depois**
- [ ] Nenhuma contradição entre `AGENTS.md`, `README.md`, `docs/*` e skills.
- [ ] Um novo dev consegue subir o projeto seguindo só a doc.

## Entradas esperadas

- A mudança ocorrida ou a doc suspeita de estar errada.

## Saídas esperadas

- Documentação corrigida, consistente e executável.
- Lista do que foi corrigido (drift eliminado).

## Arquivos comuns para revisar

- `AGENTS.md`, `skills/*/SKILL.md`, `README.md`
- `docs/{architecture,security,frontend-audit}.md`, `.env.example`
- `SKILLS.md`, `SKILLS_PT.md`, `CLONE_INFO.md`

## Boas práticas

- Doc segue o código; ao divergir, código vence e a doc é corrigida.
- Exemplos reais e testados; sem comando que não roda.
- Uma fonte de verdade por assunto; o resto aponta para ela (`AGENTS.md`).

## Erros comuns

- Deixar README afirmar "Next.js" quando é Vite/React Router.
- Documentar estrutura `app/features/shared` que não existe no código atual.
- Doc que descreve a intenção, não o que está implementado.
- Variável usada no código e ausente do `.env.example`.

## Regras obrigatórias

- Documentação reflete o código **real**, sempre.
- `AGENTS.md` é a fonte de verdade; docs conflitantes são corrigidos.
- Toda variável de ambiente usada aparece em `.env.example`.

## Exemplo de prompt usando esta Skill

> "Use a skill `documentation-architect`: corrija `README.md` e `docs/architecture.md` para
> refletir o frontend real (Vite + React 18 + React Router 6 + shadcn em
> `frontend/src/{pages,components,lib}`) e a estrutura real do backend. Liste tudo que estava errado."
