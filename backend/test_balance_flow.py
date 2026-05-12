#!/usr/bin/env python3
"""
Script para testar o fluxo completo de saldo:
1. Compra no Pagar.me (adicionar créditos)
2. Consumo de serviços (subtrair créditos)
3. Cálculo correto do saldo disponível
"""

import sys
import os

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import User, CreditTransaction, CreditPurchase
from app.core.extensions import db
from app.services.financial_service import get_balance
from app.services.credit_payment_service import _credit_purchase

def test_balance_flow():
    """Testa o fluxo completo de saldo"""
    app = create_app()
    
    with app.app_context():
        print("🔍 Testando fluxo de saldo...")
        
        # 1. Buscar usuário admin para testes
        user = User.query.filter_by(email='admin@teste.com').first()
        if not user:
            print("❌ Usuário admin não encontrado!")
            return
        
        print(f"👤 Usuário: {user.full_name} (ID: {user.id})")
        
        # 2. Verificar saldo inicial
        initial_balance = get_balance(user)
        print(f"💰 Saldo inicial: R$ {initial_balance['credits_available_brl']}")
        print(f"   - Total: R$ {initial_balance['credits_total_brl']}")
        print(f"   - Usado: R$ {initial_balance['credits_used_brl']}")
        
        # 3. Simular compra de R$ 100,00 (10.000 centavos)
        print("\n🛒 Simulando compra de R$ 100,00...")
        
        # Criar uma compra simulada
        purchase = CreditPurchase(
            user_id=user.id,
            company_id=user.company_id or 1,
            code="TEST-001",
            idempotency_key="test-001",
            package_id="essencial",
            package_name="Teste Essencial",
            kind="single",
            source="test",
            amount_cents=10000,  # R$ 100,00
            credit_cents=10000,  # R$ 100,00 em créditos
            status="paid",
            pagarme_order_id="test_order_123",
            pagarme_charge_id="test_charge_123",
        )
        db.session.add(purchase)
        db.session.flush()
        
        # Creditar a compra
        _credit_purchase(purchase, user)
        
        # 4. Verificar saldo após compra
        balance_after_purchase = get_balance(user)
        print(f"💰 Saldo após compra: R$ {balance_after_purchase['credits_available_brl']}")
        print(f"   - Total: R$ {balance_after_purchase['credits_total_brl']}")
        print(f"   - Usado: R$ {balance_after_purchase['credits_used_brl']}")
        
        # 5. Simular consumo de R$ 30,00 (3.000 centavos)
        print("\n⚖️ Simulando consumo de R$ 30,00 em serviços...")
        
        consumption_transaction = CreditTransaction(
            user_id=user.id,
            company_id=user.company_id or 1,
            type="out",
            source="client_order",
            amount=3000,  # R$ 30,00
            description="Débito — TEST-001 (Petição Teste)",
        )
        db.session.add(consumption_transaction)
        db.session.commit()
        
        # 6. Verificar saldo após consumo
        final_balance = get_balance(user)
        print(f"💰 Saldo final: R$ {final_balance['credits_available_brl']}")
        print(f"   - Total: R$ {final_balance['credits_total_brl']}")
        print(f"   - Usado: R$ {final_balance['credits_used_brl']}")
        
        # 7. Validações matemáticas
        print("\n🧮 Validações matemáticas:")
        
        expected_total = initial_balance['credits_total'] + 10000
        expected_available = expected_total - 3000
        expected_used = initial_balance['credits_used'] + 3000
        
        print(f"   Total esperado: R$ {expected_total/100:.2f}")
        print(f"   Disponível esperado: R$ {expected_available/100:.2f}")
        print(f"   Usado esperado: R$ {expected_used/100:.2f}")
        
        # 8. Verificar se os cálculos estão corretos
        total_correct = final_balance['credits_total'] == expected_total
        available_correct = final_balance['credits_available'] == expected_available
        used_correct = final_balance['credits_used'] == expected_used
        
        print(f"\n✅ Resultados:")
        print(f"   Cálculo do total: {'✅' if total_correct else '❌'}")
        print(f"   Cálculo do disponível: {'✅' if available_correct else '❌'}")
        print(f"   Cálculo do usado: {'✅' if used_correct else '❌'}")
        
        # 9. Detalhar transações
        print(f"\n📋 Transações criadas:")
        transactions = CreditTransaction.query.filter_by(user_id=user.id).order_by(CreditTransaction.created_at.desc()).limit(3).all()
        for tx in transactions:
            tx_type = "➕" if tx.type == "in" else "➖"
            print(f"   {tx_type} R$ {tx.amount/100:.2f} - {tx.description}")
        
        # 10. Limpar dados de teste
        print(f"\n🧹 Limpando dados de teste...")
        CreditTransaction.query.filter_by(description="Débito — TEST-001 (Petição Teste)").delete()
        CreditTransaction.query.filter_by(description="Compra Pagar.me - Teste Essencial").delete()
        CreditPurchase.query.filter_by(code="TEST-001").delete()
        db.session.commit()
        
        if total_correct and available_correct and used_correct:
            print("🎉 Fluxo de validação concluído com SUCESSO!")
        else:
            print("❌ Fluxo de validação FALHOU!")
        
        return total_correct and available_correct and used_correct

if __name__ == "__main__":
    test_balance_flow()
