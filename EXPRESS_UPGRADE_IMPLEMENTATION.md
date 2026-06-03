# Express Upgrade — Implementação Completa

## ✅ Pronto (Backend)

- [x] Constante `EXPRESS_UPGRADE_CENTS = 4000` (R$ 40,00) em `checkout_service.py`
- [x] Lógica de adicionar R$ 40 ao valor quando `express_upgrade=true` no checkout
- [x] ServiceOrder com flag `express_upgrade` é criado ao fazer petição
- [x] Débito de 1 crédito (base) independente de express
- [x] Função `_finalize_express_service_order()` marca como confirmado após pagamento

## ⏳ Faltando (Frontend + Integração)

### 1. Frontend — Ao criar petição, permitir express_upgrade
- [ ] Formulário de criação de petição (petição) deve ter checkbox "Express (24h)"
- [ ] Se checkbox marcado, enviar `"express_upgrade": true` para `/api/petitions`
- [ ] Resposta retorna `order.express_upgrade: true`

### 2. Frontend — Após criar petição, ir pro checkout com express_upgrade
- [ ] Detectar se `order.express_upgrade = true`
- [ ] Ao ir pro checkout, passar `service_order_id` (está em `order.id`?)
- [ ] Calcular preço: preço base + R$ 40,00 se express_upgrade = true
- [ ] Exibir ao cliente: "Petição + Express Delivery (+R$ 40,00)"

### 3. Frontend — Checkout Form
- [ ] Validar que `expected_amount` está correto (com ou sem R$ 40)
- [ ] Enviar para `/api/checkout/create`:
  ```json
  {
    "service_id": "servico_peticao",
    "expected_amount": 22000,  // 18000 (base) + 4000 (express)
    "express_upgrade": true,
    "service_order_id": 106,
    "payment_method": "credit_card",
    ...
  }
  ```

### 4. Backend — Validar integração
- [ ] `create_checkout_order()` verifica `express_upgrade` e adiciona R$ 40
- [ ] Validação de `expected_amount` passa (cliente enviou valor correto)
- [ ] Webhook de pagamento confirmado chama `_finalize_express_service_order()`
- [ ] ServiceOrder é marcado como `express_upgrade=True` + deadline=24h

## 📋 Teste End-to-End

```bash
# 1. Cliente cria petição COM express_upgrade
POST /api/petitions
{
  "express_upgrade": true,
  "tipo_peticao": "Ação ordinária",
  ...
}
# Resposta: order.id = 106, order.express_upgrade = true

# 2. Cliente vai pro checkout
POST /api/checkout/create
{
  "service_id": "servico_peticao",
  "expected_amount": 22000,  // 180 + 40 = 220 reais
  "express_upgrade": true,
  "service_order_id": 106
}
# Resposta: order.amount = 22000 ✓

# 3. Webhook de pagamento aprovado
POST /api/webhooks/pagarme
# Sistema marca ServiceOrder.express_upgrade = True
# Deadline é 24h

# 4. Cliente verifica saldo
GET /api/me/balance
# Movimento: -1 crédito (já debitado ao criar petição)
# Ordem está aguardando pagamento de R$ 220
```

## 🎯 Prioridade

1. **Urgente:** Validar que o frontend está enviando `express_upgrade: true` ao criar petição
2. **Urgente:** Validar que o checkout está recebendo `service_order_id` e `expected_amount` correto
3. **Alta:** Confirmar que webhook está marcando ServiceOrder como confirmado
4. **Média:** Melhorar mensagens de UX (mostrar "24h" no status)

## 🔍 Como Debug

```bash
# Ver ServiceOrder com express_upgrade=true
ssh root@31.97.249.204
cd /opt/peticiona
docker compose exec -T db psql -U legalcraft_admin -d legal_craft_desk
SELECT id, express_upgrade, deadline_at, status FROM service_orders WHERE user_id = 3 ORDER BY created_at DESC LIMIT 5;

# Ver Order (checkout) vinculado
SELECT id, service_order_id, amount, status FROM orders WHERE service_order_id IS NOT NULL LIMIT 5;
```
