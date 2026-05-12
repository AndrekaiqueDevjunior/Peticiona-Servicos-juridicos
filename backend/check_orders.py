#!/usr/bin/env python3
"""
Script para verificar se os pedidos de Andre Kaique foram criados corretamente
"""

import sys
import os

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import User, ServiceOrder, Petition

def check_orders():
    """Verifica os pedidos criados"""
    app = create_app()
    
    with app.app_context():
        print("🔍 Verificando pedidos no banco de dados...")
        
        # 1. Buscar usuário admin
        user = User.query.filter_by(email='admin@teste.com').first()
        if not user:
            print("❌ Usuário admin não encontrado!")
            return
        
        print(f"👤 Usuário: {user.full_name} (ID: {user.id})")
        
        # 2. Verificar petições
        petitions = Petition.query.filter_by(user_id=user.id).all()
        print(f"\n📄 Petições encontradas: {len(petitions)}")
        for petition in petitions:
            print(f"   - {petition.reference}: {petition.area_direito} - {petition.tipo_peticao}")
        
        # 3. Verificar ordens de serviço
        orders = ServiceOrder.query.filter_by(user_id=user.id).all()
        print(f"\n📋 Ordens de serviço encontradas: {len(orders)}")
        for order in orders:
            print(f"   - {order.reference}: R$ {order.total_amount / 100:.2f} - {order.status}")
            print(f"     Petição ID: {order.petition_id}")
            print(f"     Criada em: {order.created_at}")
        
        # 4. Verificar se há pedido ANDRE-KAIQUE-001
        specific_order = ServiceOrder.query.filter_by(reference="ANDRE-KAIQUE-001").first()
        if specific_order:
            print(f"\n✅ Pedido ANDRE-KAIQUE-001 encontrado:")
            print(f"   ID: {specific_order.id}")
            print(f"   Usuário ID: {specific_order.user_id}")
            print(f"   Status: {specific_order.status}")
            print(f"   Valor: R$ {specific_order.total_amount / 100:.2f}")
            print(f"   Petição ID: {specific_order.petition_id}")
        else:
            print(f"\n❌ Pedido ANDRE-KAIQUE-001 NÃO encontrado!")
        
        # 5. Verificar todos os usuários
        all_users = User.query.all()
        print(f"\n👥 Total de usuários: {len(all_users)}")
        for u in all_users:
            orders_count = ServiceOrder.query.filter_by(user_id=u.id).count()
            print(f"   - {u.full_name} ({u.email}): {orders_count} pedidos")

if __name__ == "__main__":
    check_orders()
