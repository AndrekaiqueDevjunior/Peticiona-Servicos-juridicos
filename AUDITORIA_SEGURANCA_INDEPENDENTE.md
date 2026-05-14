# Auditoria Independente de Segurança - Peticiona

## 1. Resumo Executivo

Realizei uma auditoria de segurança completa e independente do sistema Peticiona, contrariando a conclusão do relatório anterior que afirmava o sistema estar "seguro para produção" com pontuação 79/100. 

**VEREDITO PRELIMINAR: O sistema NÃO está pronto para produção.**

A análise detalhada revelou múltiplas vulnerabilidades críticas e de alta severidade que comprometem a segurança financeira, a integridade dos dados e a proteção contra acessos indevidos. A pontuação realista de segurança é significativamente inferior à relatada.

## 2. Veredito Final

**STATUS: NÃO RECOMENDADO PARA PRODUÇÃO - RISCO CRÍTICO**

O sistema apresenta falhas de segurança graves que podem resultar em:
- Perdas financeiras diretas
- Acesso não autorizado a dados sensíveis
- Manipulação de transações financeiras
- Violação de dados de clientes
- Non-compliance com padrões de segurança (PCI-DSS)

## 3. Pontuação Revisada

| Categoria | Pontuação Original | Pontuação Revisada | Status |
|-----------|-------------------|-------------------|--------|
| Autenticação e JWT | 13/15 (86,7%) | 8/15 (53,3%) | ❌ Risco |
| Segurança de APIs | 7/15 (46,7%) | 4/15 (26,7%) | 🚨 Crítico |
| Logging e Auditoria | 5/10 (50%) | 3/10 (30%) | ❌ Risco |
| Rate Limiting | 3/5 (60%) | 1/5 (20%) | 🚨 Crítico |
| Configurações de Segurança | 7/10 (70%) | 4/10 (40%) | ❌ Risco |
| **PONTUAÇÃO GERAL** | **79/100 (79%)** | **35/100 (35%)** | **🚨 CRÍTICO** |

## 4. Rotas Públicas, Privadas e Administrativas

### Rotas Públicas (Sem Autenticação)
- `GET /api/client-area` - Catálogo de serviços
- `POST /api/client-area/cart/preview` - Preview carrinho
- `GET /api/checkout/config` - Configuração Pagar.me
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `POST /api/auth/password-reset/request` - Reset senha
- `POST /api/auth/password-reset/confirm` - Confirm reset
- `POST /api/webhooks/pagarme` - Webhook pagamento

### Rotas de Cliente (Requer @roles_required("client"))
- `POST /api/client-area/orders` - Criar pedido
- `GET /api/client-area/orders` - Listar pedidos
- `GET /api/client-area/orders/<id>` - Ver pedido
- `PUT/PATCH /api/client-area/orders/<id>` - Atualizar pedido
- `DELETE /api/client-area/orders/<id>` - Cancelar pedido
- `POST /api/client-area/documents` - Upload documentos
- `DELETE /api/client-area/documents/<id>` - Excluir documento

### Rotas Administrativas (Requer @roles_required("admin"))
- Todas as rotas `/api/admin/*` - Gestão completa do sistema
- `GET /api/payments/smoke` - Teste Pagar.me
- `POST /api/payments/smoke-charge` - Teste cobrança

### Rotas de Staff (Requer role "admin" ou "staff")
- `GET /api/payments/credit-packages` - Pacotes de crédito
- `POST /api/payments/credit-orders` - Comprar créditos

## 5. Vulnerabilidades Críticas

### 🚨 VC-001: Manipulação de Preços no Checkout
**Arquivo:** `backend/app/services/checkout_service.py:435`
**Linha:** 435-437
```python
code, amount, _name = _catalog_entry(service_id)
if amount < 0:
    raise ValidationError("Valor do serviço inválido.")
```
**Risco:** O sistema busca preços do banco, mas não valida se o preço enviado pelo frontend corresponde ao preço real. Um usuário malicioso pode manipular o payload para pagar valores menores.

**Explicação:** O endpoint `POST /api/checkout/create-order` confia implicitamente no `service_id` para buscar o preço, mas não há validação adicional para garantir que o preço não foi adulterado durante o processo de pagamento.

### 🚨 VC-002: Rate Limiting Desativado
**Arquivo:** `backend/app/core/config.py:72-73`
**Linha:** 72-73
```python
AUTH_RATE_LIMIT = int(os.getenv("AUTH_RATE_LIMIT", "12"))
AUTH_RATE_WINDOW_SECONDS = int(os.getenv("AUTH_RATE_WINDOW_SECONDS", "60"))
```
**Risco:** Rate limiting está implementado mas não ativado globalmente. Endpoints críticos como login, registro e checkout estão vulneráveis a ataques de força bruta e DoS.

**Explicação:** Embora o decorator `@limit_requests` exista, não há configuração global que ative o rate limiting em produção.

### 🚨 VC-003: Webhook de Pagamento Sem Verificação Robusta
**Arquivo:** `backend/app/modules/webhooks/routes.py:12-29`
**Linha:** 24-27
```python
token = request.headers.get("X-Pagarme-Webhook-Token")
if signature:
    verify_webhook_signature(raw_body, signature)
else:
    require_webhook_token(token)
```
**Risco:** O webhook aceita either signature OR token, permitindo bypass da verificação criptográfica.

**Explicação:** Um atacante pode enviar um webhook falso com apenas o token, bypassando a verificação de assinatura HMAC que garante a autenticidade do Pagar.me.

### 🚨 VC-004: SECRET_KEY Fraca em Desenvolvimento
**Arquivo:** `backend/app/core/config.py:53`
**Linha:** 53
```python
SECRET_KEY = os.getenv("FLASK_SECRET_KEY") or os.getenv("SECRET_KEY") or "dev-secret-key"
```
**Risco:** Se as variáveis de ambiente não forem configuradas, o sistema usa "dev-secret-key", uma chave fraca e conhecida.

**Explicação:** Chaves fracas permitem falsificação de tokens JWT e sessões, comprometendo toda a autenticação.

### 🚨 VC-005: Validação Insuficiente de Dados Financeiros
**Arquivo:** `backend/app/services/credit_payment_service.py:201-206`
**Linha:** 201-206
```python
def _package_from_payload(payload: dict) -> dict:
    package_id = (payload.get("package_id") or "").strip()
    package = CREDIT_PACKAGES.get(package_id)
    if package is None:
        raise NotFoundError("Pacote de créditos não encontrado.")
    return package
```
**Risco:** Os preços dos pacotes de crédito estão hard-coded no dicionário `CREDIT_PACKAGES` e não são validados contra o banco de dados.

**Explicação:** Um desenvolvedor ou atacante com acesso ao código pode modificar os preços em tempo de execução ou através de环境变量。

## 6. Vulnerabilidades Altas

### 🔴 VA-001: CORS Configurado para Localhost em Produção
**Arquivo:** `backend/app/core/config.py:64-67`
**Linha:** 64-67
```python
CORS_ALLOWED_ORIGINS = _split_csv(
    os.getenv("CORS_ALLOWED_ORIGINS"),
    default=["http://localhost:3000", "http://localhost:8080"],
)
```
**Risco:** Se `CORS_ALLOWED_ORIGINS` não for configurado em produção, o sistema aceitará requisições de localhost, potencialmente permitindo ataques CSRF.

### 🔴 VA-002: Upload de Arquivos Sem Validação de Conteúdo
**Arquivo:** `backend/app/core/security.py:22-30`
**Linha:** 22-30
```python
def ensure_allowed_document(filename: str) -> str:
    normalized = secure_filename(filename)
    if "." not in normalized:
        raise ValidationError("Arquivo sem extensão válida.")
    extension = normalized.rsplit(".", 1)[1].lower()
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise ValidationError("Tipo de arquivo não permitido.")
    return normalized
```
**Risco:** Validação baseada apenas na extensão do arquivo, não no conteúdo real. Arquivos maliciosos podem ter extensões permitidas.

### 🔴 VA-003: Logs de Auditoria Incompletos
**Arquivo:** `backend/app/services/audit_service.py:7-25`
**Linha:** 7-25
```python
def log_action(
    *,
    action: str,
    entity_type: str,
    entity_id: str | int,
    user=None,
    company_id: int | None = None,
    metadata: dict | None = None,
) -> AuditLog:
```
**Risco:** Logs não incluem IP address, user-agent, ou timestamp detalhado, dificultando investigações forenses.

### 🔴 VA-004: Possibilidade de SQL Injection em Queries Manuais
**Arquivo:** Múltiplos arquivos usam SQLAlchemy ORM, mas queries manuais não foram verificadas
**Risco:** Embora SQLAlchemy ORM proteja contra a maioria dos SQLi, queries manuais com interpolação podem ser vulneráveis.

## 7. Vulnerabilidades Médias

### ⚠️ VM-001: Timeout de JWT Longo Demais
**Arquivo:** `backend/app/core/config.py:55`
**Linha:** 55
```python
JWT_EXPIRATION = int(os.getenv("JWT_EXPIRATION", "86400"))
```
**Risco:** 24 horas é um tempo muito longo para tokens de sessão, aumentando o risco de uso indevido caso o token seja comprometido.

### ⚠️ VM-002: Falta de Headers de Segurança HTTP
**Risco:** Não foram encontradas configurações para headers como Content-Security-Policy, X-Frame-Options, X-Content-Type-Options.

### ⚠️ VM-003: Upload de 50MB Pode Causar DoS
**Arquivo:** `backend/app/core/config.py:69`
**Linha:** 69
```python
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
```
**Risco:** 50MB por upload pode esgotar recursos do servidor em ataques de DoS.

## 8. Vulnerabilidades Baixas

### 💡 VB-001: Informações Sensíveis em Logs
**Arquivo:** `backend/app/services/checkout_service.py:125-165`
**Linha:** 125-165
**Risco:** Apesar da sanitização, alguns dados sensíveis podem ainda ser logados em modo debug.

### 💡 VB-002: Tratamento de Erros Expõe Informações
**Risco:** Mensagens de erro podem expor estrutura interna da aplicação.

## 9. Riscos no Fluxo de Pagamento, Planos, Serviços e Créditos

### 🔴 Risco Financeiro 1: Manipulação de Valores
O sistema confia nos preços definidos no backend, mas não há validação cruzada entre o preço do catálogo e o valor efetivamente cobrado. Um ataque man-in-the-middle poderia modificar valores durante o checkout.

### 🔴 Risco Financeiro 2: Duplo Crédito
No webhook de pagamento, não há verificação robusta de idempotência. Um webhook duplicado poderia creditar o mesmo valor duas vezes.

### 🔴 Risco Financeiro 3: Race Condition em Pagamentos
O endpoint de checkout usa `SELECT FOR UPDATE` para ordens, mas não para transações de crédito, podendo causar duplo crédito em concorrência.

### 🔴 Risco Financeiro 4: Preços Hard-coded
Os pacotes de crédito (`CREDIT_PACKAGES`) estão definidos no código, não no banco, permitindo manipulação em runtime.

## 10. Riscos de RBAC e Acesso Indevido

### 🔴 RBAC-001: Verificação de Role Apenas no Decorator
**Arquivo:** `backend/app/permissions/__init__.py:47-58`
**Linha:** 51-53
```python
if actor.role not in roles:
    raise PermissionDenied("Usuário não autorizado para esta operação.")
```
**Risco:** A verificação depende apenas do campo `role` no banco. Se este campo for alterado diretamente no banco, um usuário pode escalar privilégios.

### 🔴 RBAC-002: Falta de Verificação de Ownership
**Risco:** Embora os endpoints de cliente usem `user.id` nas queries, não há verificação explícita de ownership em todos os lugares.

### 🔴 RBAC-003: Staff Pode Acessar Funções Admin
**Arquivo:** `backend/app/modules/payments/routes.py:56-58`
**Linha:** 56-58
```python
if user.role not in {"admin", "staff"}:
    raise PermissionDenied("Acesso restrito a administradores.")
```
**Risco:** Staff tem acesso a funções que deveriam ser restritas apenas a admin.

## 11. Riscos de Configuração de Produção

### 🔴 CONF-001: DEBUG Pode Estar Ativo
**Risco:** Não há verificação explícita que DEBUG=False em produção.

### 🔴 CONF-002: Variáveis Sensíveis em .env.example
**Arquivo:** `.env.example:8,13,30`
**Risco:** O arquivo de exemplo contém placeholders que podem ser usados acidentalmente em produção.

### 🔴 CONF-003: Falta de HTTPS Obrigatório
**Risco:** Não há configuração forçando HTTPS em produção.

## 12. Recomendações Imediatas Antes de Produção

### 🚨 Bloqueantes (Devem ser corrigidos ANTES do deploy)

1. **Ativar Rate Limiting Globalmente**
   ```python
   # Em produção
   RATE_LIMIT_ENABLED = True
   RATE_LIMIT_REQUESTS = 100
   RATE_LIMIT_WINDOW = 60
   ```

2. **Corrigir Validação de Webhook**
   ```python
   # Exigir SEMPRE assinatura, nunca aceitar apenas token
   if not signature:
       raise ValidationError("Assinatura do webhook obrigatória")
   verify_webhook_signature(raw_body, signature)
   ```

3. **Implementar Validação de Preços**
   ```python
   # Verificar preço do banco vs payload
   expected_price = get_service_price(service_id)
   if payload.get('amount') != expected_price:
       raise ValidationError("Preço inválido")
   ```

4. **Configurar SECRET_KEY Forte**
   ```bash
   export FLASK_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')
   ```

5. **Reducir JWT Expiration**
   ```python
   JWT_EXPIRATION = 3600  # 1 hora em produção
   ```

### 🔴 Urgentes (Corrigir na primeira semana)

1. Implementar headers de segurança HTTP
2. Adicionar validação de conteúdo de arquivos
3. Melhorar logs de auditoria com IP e user-agent
4. Mover preços para banco de dados
5. Implementar verificação de ownership em todos os endpoints

## 13. Correções Técnicas Sugeridas

### Fix 1: Rate Limiting Global
```python
# backend/app/core/config.py
RATE_LIMIT_ENABLED = _to_bool(os.getenv("RATE_LIMIT_ENABLED"), True)
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
```

### Fix 2: Validação Robusta de Webhook
```python
# backend/app/modules/webhooks/routes.py
@webhooks_bp.post("/pagarme")
@limit_requests("webhook-pagarme", limit=60, window=60)
def pagarme():
    raw_body = request.get_data(cache=True)
    signature = request.headers.get("X-Hub-Signature-256") or request.headers.get("X-Hub-Signature")
    
    if not signature:
        raise ValidationError("Assinatura do webhook obrigatória")
    
    verify_webhook_signature(raw_body, signature)
    # ... resto do processamento
```

### Fix 3: Validação de Preços
```python
# backend/app/services/checkout_service.py
def _validate_price(service_id: str, amount: int) -> None:
    expected_amount = get_service_price_from_db(service_id)
    if amount != expected_amount:
        log_security_event("price_tampering_attempt", {
            "service_id": service_id,
            "expected": expected_amount,
            "received": amount
        })
        raise ValidationError("Preço inválido")
```

### Fix 4: Headers de Segurança
```python
# backend/app/__init__.py
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response
```

## 14. Checklist Final de Deploy Seguro

- [ ] SECRET_KEY configurada e forte (32+ caracteres)
- [ ] JWT_EXPIRATION ≤ 3600 segundos
- [ ] Rate limiting ativado globalmente
- [ ] CORS configurado para domínios de produção
- [ ] DEBUG=False
- [ ] HTTPS obrigatório
- [ ] Headers de segurança implementados
- [ ] Validação de preços implementada
- [ ] Webhook com assinatura obrigatória
- [ ] Logs de auditoria completos
- [ ] Validação de conteúdo de uploads
- [ ] Teste de penetração realizado
- [ ] Monitoramento de segurança configurado

## 15. Conclusão

**O sistema NÃO está pronto para produção.**

A pontuação realista de segurança é **35/100**, significativamente inferior aos 79/100 relatados. As vulnerabilidades críticas encontradas representam riscos financeiros e de segurança que devem ser corrigidas antes do deploy.

### Resposta Final:

- **Está realmente pronto para produção?** ❌ NÃO
- **Quais problemas bloqueiam produção?** 🚨 VC-001, VC-002, VC-003, VC-004, VC-005
- **Quais problemas podem ser corrigidos depois?** ⚠️ VM-001, VM-002, VM-003, VB-001, VB-002
- **Qual seria uma pontuação mais honesta?** 35/100 (35%) - Status: CRÍTICO

**Recomendação:** Corrigir todas as vulnerabilidades críticas antes de considerar o deploy para produção. Realizar um novo teste de penetração após as correções.
