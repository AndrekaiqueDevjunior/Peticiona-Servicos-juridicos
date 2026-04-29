# Projeto Peticiona

## Estrutura

- `frontend/`: aplicação Vite/React, incluindo `src/`, `public/`, Tailwind, Vitest e lockfile npm.
- `backend/`: API Flask, modelos, serviços, blueprints e testes Python.
- raiz: arquivos de deploy/orquestração (`Dockerfile`, `nginx.conf`, scripts e comandos npm compatíveis).

Os comandos principais continuam funcionando pela raiz para não quebrar produção:

```bash
npm run dev
npm run build
npm run test:frontend
npm run test:backend
```

## Preflight de Produção

Antes de publicar, rode:

```bash
npm run preflight:prod
```

Esse comando valida:

- `lint` do frontend
- testes do frontend com `vitest`
- testes do backend com `unittest`
- build de produção do Vite
- presença das variáveis essenciais no `.env`

Observações:

- Os testes do backend instalam dependências Python localmente em `.cache/backend-test-deps`.
- O preflight emite aviso se detectar `localhost` no CORS ou URL de API potencialmente não pronta para produção.

## Pagar.me

Variáveis usadas no fluxo de pagamento:

- `PAGARME_SECRET_KEY`: chave secreta usada apenas no backend.
- `PAGARME_PUBLIC_KEY`: chave pública retornada ao frontend para tokenizar cartão.
- `PAGARME_STATEMENT_DESCRIPTOR`: identificação na fatura, até 13 caracteres. Padrão: `PETICIONA`.
- `PAGARME_DRY_RUN`: use `true` somente em desenvolvimento/testes.

Endpoints principais do checkout:

- `POST /api/checkout/create-order`: cria pedido interno autenticado e calcula o valor no backend.
- `POST /api/checkout/create-payment`: cria a cobrança na Pagar.me para um pedido ainda não pago.
- `GET /api/checkout/status/:orderId`: consulta status do pedido do usuário autenticado.
- `POST /api/webhooks/pagarme`: recebe webhooks assinados da Pagar.me.

O checkout consulta os valores na tabela `service_catalog_items` e grava pedidos em `orders`. Configure na Pagar.me os eventos `order.paid`, `order.payment_failed`, `order.canceled`, `charge.paid`, `charge.payment_failed`, `charge.pending` e `charge.refunded` apontando para `/api/webhooks/pagarme`. O webhook valida `X-Hub-Signature` com HMAC-SHA1 sobre o corpo bruto usando `PAGARME_SECRET_KEY`, registra cada evento em `payment_events` e impede processamento duplicado por `gateway_event_id`. Em produção, o preflight bloqueia deploy sem `PAGARME_SECRET_KEY` e `PAGARME_PUBLIC_KEY`.
