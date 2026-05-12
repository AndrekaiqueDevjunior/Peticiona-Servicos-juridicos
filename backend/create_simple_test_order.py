#!/usr/bin/env python3
"""
Script para criar um pedido de teste simples para "Andre Kaique"
diretamente no banco de dados para análise do modal no frontend
"""

import sys
import os
from datetime import datetime, timedelta

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import User, ServiceOrder, ServiceOrderItem, Petition
from app.core.extensions import db

def create_simple_test_order():
    """Cria um pedido de teste simples diretamente no BD"""
    app = create_app()
    
    with app.app_context():
        print("🔍 Criando pedido de teste simples para Andre Kaique...")
        
        # 1. Buscar usuário admin
        user = User.query.filter_by(email='admin@teste.com').first()
        if not user:
            print("❌ Usuário admin não encontrado!")
            return
        
        print(f"👤 Criando pedido para: {user.full_name} (ID: {user.id})")
        
        # 2. Criar petição
        petition = Petition(
            user_id=user.id,
            reference="ANDRE-KAIQUE-001",
            area_direito="Direito Civil",
            tipo_peticao="Petição Inicial",
            resumo_caso="Caso de teste para Andre Kaique - análise de modal",
            detalhes="Detalhes do caso de teste para análise do modal de pedido do cliente",
            advogado_subscritor="Andre Kaique - OAB/SP 123456",
            status="pendente"
        )
        db.session.add(petition)
        db.session.flush()
        
        # 3. Criar ordem de serviço diretamente
        order = ServiceOrder(
            user_id=user.id,
            company_id=user.company_id or 1,
            reference="ANDRE-KAIQUE-001",
            petition_id=petition.id,
            total_amount=15000,  # R$ 150,00
            status="pendente",
            deadline_at=datetime.now() + timedelta(days=3)
        )
        db.session.add(order)
        db.session.flush()
        
        # 4. Criar item do pedido
        item = ServiceOrderItem(
            order_id=order.id,
            company_id=user.company_id or 1,
            code="peticao_padrao",
            title="Petição Inicial - Direito Civil",
            unit_price=15000,  # R$ 150,00
            quantity=1,
            line_total=15000  # R$ 150,00
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
        print(f"   Cliente: {user.full_name}")
        print(f"   Valor total: R$ {order.total_amount / 100:.2f}")
        print(f"   Status: {order.status}")
        print(f"   Criado em: {order.created_at}")
        print(f"   Prazo: {order.deadline_at}")
        print(f"   ⚖️ Área: {petition.area_direito}")
        print(f"   📄 Tipo: {petition.tipo_peticao}")
        
        print(f"\n👥 Partes do processo:")
        print(f"   - Andre Kaique (Requerente)")
        print(f"   - Empresa Teste Ltda (Requerido)")
        
        print(f"\n📦 Item do pedido:")
        print(f"   - {item.title}")
        print(f"     Quantidade: {item.quantity}")
        print(f"     Valor unitário: R$ {item.unit_price / 100:.2f}")
        print(f"     Total: R$ {item.line_total / 100:.2f}")
        
        print(f"\n🌐 Acesse em: http://localhost:8080/area-cliente/pedidos")
        print(f"📱 Clique no pedido para ver o modal completo!")
        
        return order

if __name__ == "__main__":
    create_simple_test_order()
