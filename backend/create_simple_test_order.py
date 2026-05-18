#!/usr/bin/env python3
"""
Script para criar um pedido de teste simples para "Andre Kaique"
diretamente no banco de dados para análise do modal no frontend
"""

import sys
import os
from datetime import datetime, timedelta
from uuid import uuid4

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.core.security import upload_folder
from app.models import (
    Document,
    Petition,
    PetitionDocumentLink,
    ServiceOrder,
    ServiceOrderItem,
    User,
)
from app.core.extensions import db


SAMPLE_DOCUMENT_TEXT = (
    "DOCUMENTO DE TESTE - PETICIONA\n"
    "================================\n"
    "Este é um arquivo gerado pelo script create_simple_test_order.py\n"
    "para validar o fluxo de anexos do pedido teste.\n"
    "Sinta-se à vontade para apagar ou substituir.\n"
)


def _attach_sample_document(petition: Petition, user: User) -> Document:
    """Cria um arquivo simples em uploads/ e vincula ao pedido como anexo."""
    folder = upload_folder()
    folder.mkdir(parents=True, exist_ok=True)
    stored_name = f"sample-{uuid4().hex[:16]}.txt"
    target = folder / stored_name
    target.write_text(SAMPLE_DOCUMENT_TEXT, encoding="utf-8")

    document = Document(
        user_id=user.id,
        company_id=user.company_id,
        file_name="documento-teste.txt",
        stored_name=stored_name,
        mime_type="text/plain",
        size_bytes=target.stat().st_size,
    )
    db.session.add(document)
    db.session.flush()

    db.session.add(
        PetitionDocumentLink(
            petition_id=petition.id,
            document_id=document.id,
            company_id=user.company_id,
        )
    )
    return document

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

        # 5. Anexar documento de exemplo para que o cliente possa testar o
        #    download a partir da tela do pedido.
        attached_document = _attach_sample_document(petition, user)

        # 6. Commit das alterações
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
        
        print(f"\n📎 Documento anexado:")
        print(f"   - {attached_document.file_name} ({attached_document.size_bytes} bytes)")

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
