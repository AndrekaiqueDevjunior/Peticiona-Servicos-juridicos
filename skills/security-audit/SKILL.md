# OWASP Backend-First Security Auditor

## Objetivo

Auditar a postura de segurança do Peticiona seguindo OWASP: validação/saneamento de entrada,
headers de segurança, CORS, rate limit, **upload seguro de documentos** (allowlist + magic
bytes) e tratamento seguro de erros — sempre validando no backend, nunca confiando no frontend.

## Quando usar

- Antes de subir mudança que toca entrada de usuário, upload, headers, CORS ou erros.
- Em auditoria periódica de segurança.
- Ao adicionar endpoint que recebe arquivo ou dado externo.
- Ao revisar mensagens de erro e exposição de dados.

## Quando não usar

- Para autorização por role/escopo em profundidade (use `auth-rbac`).
- Para integridade financeira (use `credit-ledger-payments`).

## Responsabilidades

- Validar headers em `app/__init__.py` (XCTO, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP/HSTS em prod).
- Conferir CORS allowlist (`CORS_ALLOWED_ORIGINS`) e que produção exige allowlist.
- Verificar rate limit em login/cadastro (`core/rate_limit.py`).
- Auditar **upload** (`core/security.py`): allowlist de extensão, bloqueio de extensões perigosas,
  validação por **magic bytes**, limite de tamanho, `secure_filename`.
- Garantir saneamento de entrada, prevenção de injeção e erros sem stack trace.
- Conferir que segredos não vazam em logs/respostas.

## Checklist operacional

**Antes**
- [ ] Que superfície muda (entrada, arquivo, header, erro)?
- [ ] Há dado de usuário chegando sem validação?

**Durante**
- [ ] Entrada validada/saneada no backend (schema), não só no frontend.
- [ ] Upload: extensão na allowlist, não-perigosa, magic bytes batem, tamanho ≤ `MAX_UPLOAD_MB`, nome higienizado.
- [ ] Sem SQL/Comando montado por concatenação de input.
- [ ] Headers de segurança presentes; CSP/HSTS em produção.
- [ ] Erro não vaza stack/segredo; mensagem genérica ao cliente.

**Depois**
- [ ] Teste com arquivo malicioso (extensão dupla, conteúdo trocado) é rejeitado.
- [ ] Teste de input malformado/injeção falha com segurança.
- [ ] Rodar `security_scan.py` e revisar achados.

## Entradas esperadas

- A superfície a auditar (endpoint, upload, header, fluxo de erro).

## Saídas esperadas

- Relatório de achados por severidade + correção proposta.
- Confirmação de que entrada, upload e erros estão seguros no backend.

## Arquivos comuns para revisar

- `backend/app/__init__.py`, `backend/app/core/{security,rate_limit,errors,config}.py`
- `backend/app/modules/documents/`, `nginx.conf`, `.env.example`
- `security_scan.py`, `docs/security.md`, `AUDITORIA_SEGURANCA_INDEPENDENTE.md`

## Boas práticas

- Validar no servidor sempre; frontend é conveniência.
- Allowlist > blocklist; ainda assim bloquear extensões perigosas conhecidas.
- Validar conteúdo (magic bytes), não só extensão.
- Erros opacos para o cliente, detalhados nos logs do servidor (sem segredo).

## Erros comuns

- Confiar na extensão/`Content-Type` enviados pelo cliente.
- CORS com `*` ou origem ampla em produção.
- Stack trace/`debug=True` exposto em produção.
- Logar token/senha/PII.
- Aceitar upload sem limite de tamanho ou sem `secure_filename`.

## Regras obrigatórias

- Toda entrada validada/saneada no backend.
- Upload validado por allowlist **e** magic bytes **e** tamanho.
- Headers de segurança e CORS allowlist obrigatórios em produção.
- Nunca confiar no frontend para bloquear ação sensível.

## Exemplo de prompt usando esta Skill

> "Use a skill `security-audit`: audite o endpoint de upload de documentos. Tente burlar com
> extensão dupla (`.pdf.exe`), conteúdo trocado e arquivo gigante. Confirme allowlist, magic
> bytes, limite de tamanho e `secure_filename`, e me dê o relatório com severidade."
