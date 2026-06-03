# Pagar.me / Resend / Nemotron Integration Specialist

## Objetivo

Integrar e revisar provedores externos do Peticiona — **Pagar.me** (pagamento/split),
**Resend** (e-mail + webhook) e **Nemotron/NVIDIA** (IA) — com segredos protegidos, webhooks
verificados, idempotência e tolerância a falhas, sem simular integração como se fosse real.

## Quando usar

- Ao chamar Pagar.me (cobrança, split, consulta) ou processar seu webhook.
- Ao enviar e-mail via Resend ou tratar o webhook de eventos de e-mail.
- Ao usar Nemotron para gerar/assistir texto jurídico.
- Ao revisar tratamento de erro/timeout/retry de provedores.

## Quando não usar

- Para a lógica de saldo/split em si (use `credit-ledger-payments`).
- Para headers/CORS gerais (use `security-audit`).

## Responsabilidades

- Garantir segredos só via `.env` (`RESEND_*`, chaves Pagar.me, chave Nemotron), nunca hardcoded.
- **Verificar assinatura/segredo de webhook** antes de processar (Pagar.me, `RESEND_WEBHOOK_SECRET`).
- Tornar handlers de webhook **idempotentes** (evento repetido não duplica efeito).
- Tratar timeout, erro de provider e indisponibilidade sem corromper estado local.
- Registrar eventos (`models/email_event.py`, auditoria) e nunca logar segredo/PII sensível.
- Garantir que respostas de IA passem por validação antes de virar conteúdo entregue.

## Checklist operacional

**Antes**
- [ ] Variáveis do provider existem em `.env`/`.env.example`? Modo sandbox vs produção claro?
- [ ] O webhook tem segredo/assinatura para validar?

**Durante**
- [ ] Chamada externa isolada no `*_service.py`; sem chave no código.
- [ ] Webhook valida assinatura antes de qualquer efeito; rejeita inválido.
- [ ] Efeitos do webhook idempotentes (usar id do evento/pagamento como chave).
- [ ] Timeout e tratamento de erro definidos; falha de provider não deixa estado inconsistente.
- [ ] Sem log de segredo, token, dados de cartão ou PII desnecessária.

**Depois**
- [ ] Teste com payload de webhook válido e inválido.
- [ ] Teste de reentrega (mesmo evento 2x não duplica crédito/efeito).
- [ ] Saída de IA validada/saneada antes de exibir/entregar.

## Entradas esperadas

- O provider, a operação, os payloads esperados e o segredo/assinatura do webhook.

## Saídas esperadas

- Integração real, segura, idempotente e tolerante a falha.
- Relatório de riscos (segredo exposto, webhook sem verificação, retry duplicando efeito).

## Arquivos comuns para revisar

- `backend/app/services/{pagarme_service,email_service,nemotron_service}.py`
- `backend/app/modules/{webhooks,payments,split_payment,contact,notifications}/`
- `backend/app/models/email_event.py`, `.env.example`

## Boas práticas

- Validar assinatura de webhook sempre; tratar replay.
- Idempotência ligada ao id do provider.
- Backoff/timeout em chamadas externas; circuit-break para IA.
- Separar credenciais sandbox vs produção por ambiente.

## Erros comuns

- Processar webhook sem verificar assinatura → forjar pagamento.
- Reprocessar evento e creditar duas vezes (sem idempotência).
- Segredo hardcoded no código/commit.
- Confiar 100% na saída do Nemotron sem validação.
- Logar payload com dados sensíveis.

## Regras obrigatórias

- Webhook **só** age após validar assinatura/segredo.
- Handlers de webhook são **idempotentes**.
- Segredos só em `.env`; nunca commitar nem logar.
- Integração nunca é simulada como real (ver `anti-mock-audit`).

## Exemplo de prompt usando esta Skill

> "Use a skill `external-integrations`: revise o handler de webhook do Pagar.me em
> `modules/webhooks`. Confirme que valida assinatura, é idempotente por `payment_id` e credita
> via `credit_ledger`. Se um evento chegar 2x, não pode creditar duas vezes — me mostre onde isso pode falhar."
