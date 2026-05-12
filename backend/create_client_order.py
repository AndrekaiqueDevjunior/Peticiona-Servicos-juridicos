#!/usr/bin/env python3
"""
Script para criar um pedido para o usuário cliente e testar visualização
"""

import sys
import os
from datetime import datetime, timedelta

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import User, ServiceOrder, ServiceOrderItem, Petition
from app.core.extensions import db

def create_client_order():
    """Cria um pedido para o usuário cliente"""
    app = create_app()
    
    with app.app_context():
        print("🔍 Criando pedido para usuário cliente...")
        
        # 1. Buscar usuário cliente
        client_user = User.query.filter_by(email='andre.kaique@cliente.com').first()
        if not client_user:
            print("❌ Usuário cliente não encontrado!")
            return
        
        print(f"👤 Usuário: {client_user.full_name} (ID: {client_user.id})")
        print(f"🔑 Função: {client_user.role}")
        
        # 2. Criar petição para o cliente
        petition = Petition(
            user_id=client_user.id,
            reference="CLIENTE-001",
            area_direito="Direito Civil",
            tipo_peticao="Petição Inicial",
            resumo_caso="Caso de teste para cliente - Andre Kaique",
            detalhes="Detalhes do caso de teste para verificação de pedidos do cliente",
            advogado_subscritor="Andre Kaique - OAB/SP 123456",
            status="pendente"
        )
        db.session.add(petition)
        db.session.flush()
        
        # 3. Criar ordem de serviço para o cliente
        order = ServiceOrder(
            user_id=client_user.id,
            company_id=client_user.company_id,
            reference="CLIENTE-001",
            petition_id=petition.id,
            total_amount=20000,  # R$ 200,00
            status="pendente",
            deadline_at=datetime.now() + timedelta(days=5)
        )
        db.session.add(order)
        db.session.flush()
        
        # 4. Criar item do pedido
        item = ServiceOrderItem(
            order_id=order.id,
            company_id=client_user.company_id,
            code="peticao_padrao",
            title="Petição Inicial - Direito Civil",
            unit_price=20000,  # R$ 200,00
            quantity=1,
            line_total=20000  # R$ 200,00
        )
        db.session.add(item)
        
        # 5. Commit das alterações
        db.session.commit()
        
        print("✅ Pedido criado com sucesso!")
        print(f"📋 Número do pedido: {order.reference}")
        print(f"💰 Valor: R$ {order.total_amount / 100:.2f}")
        print(f"📅 Prazo: {order.deadline_at}")
        print(f"📝 Status: {order.status}")
        
        print(f"\n📋 Detalhes completos:")
        print(f"   ID do Pedido: {order.id}")
        print(f"   ID da Petição: {petition.id}")
        print(f"   Referência: {order.reference}")
        print(f"   Cliente: {client_user.full_name}")
        print(f"   Email: {client_user.email}")
        print(f"   Função: {client_user.role}")
        print(f"   Valor total: R$ {order.total_amount / 100:.2f}")
        print(f"   Status: {order.status}")
        print(f"   Criado em: {order.created_at}")
        print(f"   Prazo: {order.deadline_at}")
        print(f"   ⚖️ Área: {petition.area_direito}")
        print(f"   📄 Tipo: {petition.tipo_peticao}")
        
        print(f"\n📦 Item do pedido:")
        print(f"   - {item.title}")
        print(f"     Quantidade: {item.quantity}")
        print(f"     Valor unitário: R$ {item.unit_price / 100:.2f}")
        print(f"     Total: R$ {item.line_total / 100:.2f}")
        
        print(f"\n🌐 Para testar:")
        print(f"1. Faça login com: andre.kaique@cliente.com / cliente123")
        print(f"2. Acesse: http://localhost:8080/area-cliente/pedidos")
        print(f"3. O pedido CLIENTE-001 deve aparecer na lista!")
        
        return order

if __name__ == "__main__":
    create_client_order()
