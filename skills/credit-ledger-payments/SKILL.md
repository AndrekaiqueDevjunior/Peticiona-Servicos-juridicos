# Credit Ledger & Payment/Split Integrity Auditor

## Objetivo

Proteger a integridade financeira do Peticiona: garantir que **toda** mutação de saldo passe
pelo livro-razão único (`app/services/credit_ledger.py`) e que checkout, créditos, débitos,
reembolsos, **express upgrade** e **split payment** respeitem idempotência, lock por usuário e
invariante de saldo não-negativo.

## Quando usar

- Ao mexer em saldo, créditos, débitos, reembolso, checkout, planos ou split payment.
- Ao revisar `credit_ledger`, `credit_payment_service`, `checkout_service`, `split_payment_service`.
- Ao precificar serviços/petições ou aplicar express upgrade.
- Em qualquer fluxo que escreva em `credit_transactions`.

## Quando não usar

- Para a integração HTTP com o Pagar.me em si (use `external-integrations`).
- Para autorização de quem pode pagar (use `auth-rbac`).

## Responsabilidades

- Garantir que `credit_transactions` só seja mutado via `credit_ledger.credit/debit/refund`.
- Confirmar tipos restritos: **apenas `'in'` e `'out'`** (qualquer outro = `LedgerCorruption`).
- Validar uso de `idempotency_key` para evitar débito/crédito duplicado.
- Confirmar advisory lock por usuário em mutações concorrentes (PostgreSQL).
- Garantir invariante de **saldo não-negativo** e valores em **centavos**.
- Validar cálculo de preço/split no backend e auditoria de cada movimento.

## Checklist operacional

**Antes**
- [ ] Esta operação altera saldo? Se sim, vai passar por `credit_ledger`?
- [ ] Há `idempotency_key` derivada de algo estável (ex.: `order_ref`, `payment_id`)?

**Durante**
- [ ] Nenhum `INSERT`/`UPDATE` direto em `credit_transactions` fora do ledger.
- [ ] `type` ∈ {`in`,`out`}; débito checa saldo dentro do lock.
- [ ] Valores em centavos (inteiro); split soma exatamente o total (sem sobra de arredondamento).
- [ ] Reembolso usa `refund(original_tx, …)` (espelha o tipo original).
- [ ] Cada movimento gera auditoria; nada calculado no frontend.

**Depois**
- [ ] Teste de concorrência/idempotência (duas requisições não duplicam nem furam o saldo).
- [ ] Teste de saldo insuficiente bloqueia o débito.
- [ ] Conferência: soma de `in` − soma de `out` = saldo exibido.

## Entradas esperadas

- O fluxo financeiro (compra de créditos, débito por petição, upgrade, reembolso, split).
- Valores, moeda (centavos) e a chave de idempotência candidata.

## Saídas esperadas

- Fluxo financeiro íntegro, idempotente e auditado, usando o ledger.
- Relatório de divergências de saldo/duplicidade/arredondamento, se houver.

## Arquivos comuns para revisar

- `backend/app/services/{credit_ledger,credit_payment_service,checkout_service,financial_service,split_payment_service}.py`
- `backend/app/models/{credits,payments,financial,plans,order,orders}.py`
- `backend/app/modules/{checkout,payments,split_payment}/`
- `backend/app/domain/plan_rules.py`, `frontend/src/lib/{pricing,balance,checkoutApi}.ts`

## Boas práticas

- Pensar em centavos; nunca `float` para dinheiro.
- Idempotência sempre que houver retry/webhook.
- Recalcular saldo a partir do ledger (fonte única), não cachear valor mutável.
- Cada centavo movido tem descrição, `source` e auditoria.

## Erros comuns

- Escrever em `credit_transactions` direto no service de checkout/admin (a dor que o ledger eliminou).
- Filtrar débito de cancelamento por `description LIKE %ref%` em vez de idempotência.
- Split que não fecha o total por arredondamento.
- Crédito duplicado em retry de webhook por falta de `idempotency_key`.
- Confiar no preço enviado pelo frontend.

## Regras obrigatórias

- **Toda** mutação de saldo passa por `credit_ledger`. Sem exceção.
- Tipos só `'in'`/`'out'`; saldo nunca negativo.
- Dinheiro em centavos; preço/split calculados no backend.
- Operações financeiras idempotentes e auditadas.

## Exemplo de prompt usando esta Skill

> "Use a skill `credit-ledger-payments`: revise o fluxo de `express_upgrade`. Confirme que o
> débito passa pelo `credit_ledger` com `idempotency_key`, que o preço vem do backend e que um
> retry não cobra duas vezes. Aponte qualquer escrita direta em `credit_transactions`."
