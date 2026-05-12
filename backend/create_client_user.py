#!/usr/bin/env python3
"""
Script para criar um usuário cliente para testar visualização de pedidos
"""

import sys
import os

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import User, Company
from app.core.extensions import db
from werkzeug.security import generate_password_hash
from app.services.auth_service import create_access_token

def create_client_user():
    """Cria um usuário cliente para testes"""
    app = create_app()
    
    with app.app_context():
        print("🔍 Criando usuário cliente para testes...")
        
        # 1. Verificar se já existe
        existing_client = User.query.filter_by(email='andre.kaique@cliente.com').first()
        if existing_client:
            print("❌ Usuário cliente já existe!")
            print(f"📧 Email: {existing_client.email}")
            print(f"👤 Nome: {existing_client.full_name}")
            print(f"🔑 Função: {existing_client.role}")
            return existing_client
        
        # 2. Buscar ou criar empresa
        company = Company.query.filter_by(slug="cliente-teste").first()
        if not company:
            company = Company(
                name="Cliente Teste",
                slug="cliente-teste"
            )
            db.session.add(company)
            db.session.flush()
        
        # 3. Criar usuário cliente
        client_user = User(
            full_name="Andre Kaique Cliente",
            email="andre.kaique@cliente.com",
            password_hash=generate_password_hash("cliente123"),
            role="client",
            company_id=company.id,
            phone="11968029600",
            street="R. Padre Jacinto Nunes",
            street_number="22",
            neighborhood="Cangaiba - PENHA",
            city="São Paulo",
            state="SP",
            zip_code="03720-020",
            is_active=True
        )
        db.session.add(client_user)
        db.session.commit()
        
        # 4. Gerar token JWT
        token = create_access_token(user_id=client_user.id)
        
        print("✅ Usuário cliente criado com sucesso!")
        print(f"📧 Email: {client_user.email}")
        print(f"👤 Nome: {client_user.full_name}")
        print(f"🔑 Função: {client_user.role}")
        print(f"🏢 Empresa: {company.name}")
        print(f"🔑 Token JWT: {token}")
        print(f"🔐 Senha: cliente123")
        
        print(f"\n🌐 Para testar:")
        print(f"1. Faça login com: andre.kaique@cliente.com / cliente123")
        print(f"2. Acesse: http://localhost:8080/area-cliente/pedidos")
        print(f"3. Use o token: {token}")
        
        return client_user

if __name__ == "__main__":
    create_client_user()
