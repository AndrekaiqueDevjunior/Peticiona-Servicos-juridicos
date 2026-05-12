#!/usr/bin/env python3
"""
Script para criar um pedido de teste para "Andre Kaique"
para análise do modal de pedido no frontend
"""

import sys
import os

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import User, ServiceOrder, ServiceOrderItem, Petition
from app.core.extensions import db
from app.services.client_area_service import create_order
from datetime import datetime, timedelta

def create_test_order_for_andre():
    """Cria um pedido de teste para Andre Kaique"""
    app = create_app()
    
    with app.app_context():
        print("🔍 Criando pedido de teste para Andre Kaique...")
        
        # 1. Buscar usuário admin para criar o pedido
        user = User.query.filter_by(email='admin@teste.com').first()
        if not user:
            print("❌ Usuário admin não encontrado!")
            return
        
        print(f"👤 Criando pedido para: {user.full_name} (ID: {user.id})")
        
        # 2. Criar uma petição associada
        petition = Petition(
            user_id=user.id,
            reference="TEST-ANDRE-001",
            area_direito="Direito Civil",
            tipo_peticao="Petição Inicial",
            resumo_caso="Caso de teste para análise do modal de pedido do cliente",
            detalhes="Pedido de teste para análise do modal - Andre Kaique",
            advogado_subscritor="Andre Kaique - OAB/SP 123456",
            status="pendente"
        )
        db.session.add(petition)
        db.session.flush()
        
        # 3. Criar o pedido usando o serviço existente
        order_payload = {
            "items": [
                {
                    "service_id": "peticao_padrao",
                    "title": "Petição Inicial - Direito Civil",
                    "quantity": 1,
                    "unit_price": 15000,  # R$ 150,00
                    "line_total": 15000
                }
            ],
            "petition_reference": petition.reference,
            "area_direito": petition.area_direito,
            "tipo_peticao": petition.tipo_peticao,
            "detalhes": petition.detalhes,
            "partes": [
                {"nome": "Andre Kaique", "tipo": "Requerente"},
                {"nome": "Empresa Teste Ltda", "tipo": "Requerido"}
            ]
        }
        
        # Criar o pedido
        order_result, status = create_order(order_payload, user=user)
        
        if status == 201:
            print("✅ Pedido criado com sucesso!")
            print(f"📋 Número do pedido: {order_result.get('order', {}).get('reference', 'N/A')}")
            print(f"💰 Valor: R$ {order_result.get('order', {}).get('total_amount', 0) / 100:.2f}")
            print(f"📅 Prazo: {order_result.get('order', {}).get('deadline_at', 'Não definido')}")
            print(f"📝 Status: {order_result.get('order', {}).get('status', 'Pendente')}")
            
            # 4. Exibir detalhes completos
            order = order_result.get('order', {})
            print(f"\n📋 Detalhes completos do pedido:")
            print(f"   ID: {order.get('id', 'N/A')}")
            print(f"   Referência: {order.get('reference', 'N/A')}")
            print(f"   Cliente: {order.get('client_name', user.full_name)}")
            print(f"   Tipo de serviço: {order.get('service_type', 'Petição')}")
            print(f"   Modalidade: {order.get('modality', 'Padrão')}")
            print(f"   Área do direito: {order.get('area_direito', 'N/A')}")
            print(f"   Tipo de petição: {order.get('tipo_peticao', 'N/A')}")
            print(f"   Valor total: R$ {order.get('total_amount', 0) / 100:.2f}")
            print(f"   Status: {order.get('status', 'Pendente')}")
            print(f"   Criado em: {order.get('created_at', 'N/A')}")
            print(f"   Prazo: {order.get('deadline_at', 'N/A')}")
            
            # 5. Listar partes se houver
            partes = order.get('partes', [])
            if partes:
                print(f"\n👥 Partes do processo:")
                for parte in partes:
                    print(f"   - {parte.get('nome', 'N/A')} ({parte.get('tipo', 'N/A')})")
            
            # 6. Listar itens do pedido
            items = order.get('items', [])
            if items:
                print(f"\n📦 Itens do pedido:")
                for item in items:
                    print(f"   - {item.get('title', 'N/A')}")
                    print(f"     Quantidade: {item.get('quantity', 0)}")
                    print(f"     Valor unitário: R$ {item.get('unit_price', 0) / 100:.2f}")
                    print(f"     Total: R$ {item.get('line_total', 0) / 100:.2f}")
            
            print(f"\n🌐 Acesse o pedido em: http://localhost:8080/area-cliente/pedidos")
            print(f"📱 O pedido estará disponível no modal de detalhes do cliente!")
            
        else:
            print(f"❌ Erro ao criar pedido: {order_result}")
            print(f"Status: {status}")
        
        return order_result if status == 201 else None

if __name__ == "__main__":
    create_test_order_for_andre()
