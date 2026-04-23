# Projeto Peticiona

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
