# Bug Investigation Flow

## Objetivo

Investigar bugs do Peticiona de forma metódica: reproduzir, localizar a camada correta, achar a
**causa raiz** (não o sintoma), corrigir na camada certa e blindar com teste — com atenção
extra quando o bug toca saldo, pagamento, role ou acesso.

## Quando usar

- Ao receber um relato de bug ou comportamento inesperado.
- Quando um valor/saldo/status aparece errado.
- Quando algo "some" da tela (visibilidade/escopo) ou falha intermitente.

## Quando não usar

- Para implementar feature nova (use `backend-api`/`project-architecture`).
- Como atalho para "remendar" no frontend uma falha de regra (corrigir no backend).

## Responsabilidades

- Reproduzir o bug com request/usuário/role reais.
- Mapear a camada (frontend exibe? API responde? service calcula? model persiste?).
- Ler o código e confirmar a causa raiz antes de alterar.
- Corrigir na camada correta e adicionar teste de regressão.
- Avaliar impacto de segurança/financeiro/auditoria.

## Checklist operacional

**Antes**
- [ ] Passos exatos para reproduzir; usuário, role e dados envolvidos.
- [ ] Comportamento esperado vs observado, com evidência (request/response, log).

**Durante**
- [ ] Isolar a camada: inspecionar response da API real; logs do backend; estado do banco.
- [ ] Conferir escopo/permissões se o bug é "dado some/aparece" (ver `scoped_query`).
- [ ] Se envolve saldo/dinheiro: comparar ledger (`in`/`out`) com valor exibido.
- [ ] Confirmar a causa raiz lendo o código; não adivinhar.

**Depois**
- [ ] Corrigir na camada certa (regra → backend).
- [ ] Teste que falhava antes e passa agora.
- [ ] Verificar se o mesmo padrão de bug existe em outros lugares.

## Entradas esperadas

- Relato com passos, role/usuário, evidência (print, log, request/response).

## Saídas esperadas

- Causa raiz identificada e explicada.
- Correção na camada correta + teste de regressão.
- Nota de impacto (segurança/financeiro/dados) quando aplicável.

## Arquivos comuns para revisar

- `backend/app/modules/**/routes.py`, `backend/app/services/*.py`, `backend/app/models/*.py`
- `backend/app/core/errors.py`, `LOG_FILE`
- `frontend/src/lib/*.ts`, `frontend/src/pages/**`
- `RELATORIO_DIAGNOSTICO.md`, `docs/audit-*.md`

## Boas práticas

- Reproduzir primeiro; só então mexer.
- Uma hipótese por vez, validada com evidência.
- Corrigir causa, não sintoma; regra sempre no backend.
- Deixar teste que impeça a regressão.

## Erros comuns

- "Consertar" no frontend uma falha de regra do backend.
- Mudar código sem reproduzir (corrige o sintoma errado).
- Ignorar concorrência/idempotência em bug financeiro.
- Não checar se o bug é de escopo/permissão antes de mexer em dados.

## Regras obrigatórias

- Causa raiz confirmada antes de corrigir.
- Correção na camada correta + teste de regressão.
- Bug financeiro/de acesso exige revisão de segurança e auditoria.

## Exemplo de prompt usando esta Skill

> "Use a skill `bug-investigation`: cliente diz que o saldo dele aparece R$ 50 a mais após
> cancelar um pedido. Reproduza, compare o ledger (`in`/`out`) com o saldo exibido, ache a causa
> raiz no fluxo de cancelamento/reembolso e proponha correção + teste de regressão."
