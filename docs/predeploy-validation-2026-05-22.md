# Validacao pre-deploy - 2026-05-22

## Escopo

Validacao local antes de tocar producao, cobrindo diff, backend, frontend,
smoke E2E, migrations runtime, variaveis de ambiente, build, rollback e
go/no-go.

## Resultado

**NO-GO para producao ate resolver os bloqueios abaixo.**

Bloqueios:

- Referencia `prod` nao existe localmente nem em remotes apos `git fetch --all --prune`; nao foi possivel gerar o diff `origin/main..prod`.
- `.env` local nao define `DATABASE_URL` e `RATE_LIMIT_ENABLED`; para producao, `DATABASE_URL` deve apontar para PostgreSQL e `RATE_LIMIT_ENABLED=true`.
- Smoke E2E versionado no repo possui 12 testes, nao 14; foi validado como 12/12. Nao ha alvo `14/14` encontrado no codigo/docs.

## Evidencias

Comandos executados:

- `rtk git fetch --all --prune`
- `rtk git branch --all --verbose --no-abbrev`
- `rtk ./venv/bin/pytest tests/ -q`
- `rtk npx tsc -b --noEmit`
- `rtk ./venv/bin/pytest tests/modules/client_area/test_client_flow_end_to_end.py -q`
- `rtk ./venv/bin/pytest tests/modules/webhooks/test_resend_webhook.py -q`
- Validacao runtime migration em SQLite efemero, executando `run_runtime_migrations()` duas vezes no mesmo banco apos inserir `email_events`.
- `rtk npm run build`
- Validacao de chaves do `.env` sem imprimir valores.

Resultados confirmados:

- Backend suite: 381 passed, 3 warnings de JWT curto em testes.
- TypeScript: sem erros apos ajuste em `ContactForm`.
- Smoke E2E versionado: 12 passed.
- Webhook Resend: 11 passed.
- Runtime migration: preservou evento inserido apos duas execucoes.
- Frontend build: `dist/` gerado com sucesso; Vite emitiu apenas aviso de chunk > 500 kB.

## Correcoes aplicadas durante a validacao

- `frontend/src/components/landing/ContactForm.tsx`: payload de contato agora e explicitamente montado como `ContactPayload` apos validacao Zod.
- `backend/app/bootstrap/migrations.py`: migration de `email_events` deixou de fazer `DROP TABLE`; agora cria/adapta colunas e cria indices com `IF NOT EXISTS`.

## Rollback

Rollback recomendado caso o deploy ja tenha iniciado e alguma verificacao de
saude falhe:

1. Pausar novas liberacoes e manter o deploy atual fora do balanceador, se aplicavel.
2. Restaurar a revisao anterior do app na VPS/orquestrador.
3. Reimplantar a imagem/build anterior do frontend.
4. Reiniciar backend com a revisao anterior e confirmar `/api/health`.
5. Se o deploy chegou a tocar banco, restaurar o backup pre-deploy ou aplicar script compensatorio revisado manualmente. Nao executar rollback destrutivo sem snapshot validado.
6. Rodar smoke pos-rollback: login, listagem de pedidos, download de documento, checkout dry-run/smoke autorizado, webhook com assinatura invalida retornando 401.
7. Conferir logs de erro do backend, Nginx/proxy e gateway de pagamento por pelo menos 15 minutos.

## Checklist go/no-go

- [x] Repo local limpo antes da validacao.
- [ ] Diff `origin/main..prod` anexado e revisado.
- [x] Backend suite verde.
- [x] TypeScript frontend verde.
- [x] Smoke E2E versionado verde.
- [x] Runtime migration idempotente e nao-destrutiva em validacao local.
- [ ] Variaveis obrigatorias de producao presentes no ambiente real.
- [x] Build frontend gera `dist/`.
- [x] Rollback documentado.

Go final somente depois de:

- Criar/apontar a referencia `prod` correta e revisar o diff.
- Confirmar `DATABASE_URL` PostgreSQL e `RATE_LIMIT_ENABLED=true` no ambiente real de producao.
- Confirmar se o alvo esperado de smoke e 12/12 ou fornecer o runner 14/14.
