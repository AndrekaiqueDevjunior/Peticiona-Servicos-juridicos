# Segurança aplicada

## Diretrizes adotadas

- O frontend não guarda segredo, credencial de banco ou lógica de cálculo.
- O backend `Flask` concentra autenticação, prévia de carrinho, cálculo de split payment e upload.
- Entradas sensíveis passam por validação explícita em `schemas/`.
- Senhas de usuário são armazenadas com hash usando Werkzeug.
- Respostas de autenticação usam `Cache-Control: no-store`.
- CORS fica restrito às origens configuradas em `.env`.
- A API adiciona cabeçalhos defensivos inspirados no OWASP:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `Content-Security-Policy`
- Uploads aceitam somente extensões em allowlist e obedecem a limite máximo configurável.
- O backend aplica uma limitação simples de tentativas para `login` e `register`.
- O fluxo de `split payment` não confia em valor ou destinatários vindos do navegador.
- O backend emite um contexto assinado para o split e rejeita payload adulterado ou expirado.
- As rotas de split usam `Cache-Control: no-store` e rate limiting.

## Separação de responsabilidade

- `frontend/`: renderização, navegação, formulários e estado visual.
- `backend/modules/*/service.py`: regra de negócio.
- `backend/modules/*/routes.py`: serialização HTTP.
- `backend/modules/*/schemas.py`: contratos de entrada.

## Observações

- A autenticação foi deixada em nível de API demonstrativo, sem sessão persistente ou JWT.
- Para produção, o próximo passo natural é adicionar CSRF caso o projeto use cookies de sessão, além de observabilidade e rate limiting distribuído.
