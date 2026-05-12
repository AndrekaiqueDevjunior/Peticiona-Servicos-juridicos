#!/usr/bin/env python3
"""
Script para criar um usuário administrador para testes
"""

import sys
import os

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import User, Company
from app.core.extensions import db
from app.core.jwt import create_access_token
from werkzeug.security import generate_password_hash
from datetime import datetime

def create_admin_user():
    """Cria um usuário administrador para testes"""
    app = create_app()
    
    with app.app_context():
        # Verificar se já existe um admin
        existing_admin = User.query.filter_by(email='admin@teste.com').first()
        if existing_admin:
            print("❌ Usuário admin já existe!")
            print(f"📧 Email: {existing_admin.email}")
            print(f"👤 Nome: {existing_admin.full_name}")
            print(f"🔑 Token: {create_access_token(user_id=existing_admin.id)}")
            return existing_admin
        
        # Criar company para o admin
        company = Company(
            name="Peticiona Admin",
            slug="peticiona-admin"
        )
        db.session.add(company)
        db.session.flush()  # Para obter o ID da company
        
        # Criar usuário admin
        admin_user = User(
            full_name="Administrador Teste",
            email="admin@teste.com",
            password_hash=generate_password_hash("admin123"),
            role="admin",
            is_active=True,
            company_id=company.id,
            role_title="Administrador do Sistema",
            employee_code="ADMIN-001"
        )
        
        db.session.add(admin_user)
        db.session.commit()
        
        # Gerar token de acesso
        token = create_access_token(user_id=admin_user.id)
        
        print("✅ Usuário administrador criado com sucesso!")
        print(f"📧 Email: admin@teste.com")
        print(f"🔑 Senha: admin123")
        print(f"👤 Nome: {admin_user.full_name}")
        print(f"🎭 Role: {admin_user.role}")
        print(f"🔐 Token JWT: {token}")
        print("\n📋 Use estas credenciais para acessar a área administrativa!")
        
        return admin_user

if __name__ == "__main__":
    create_admin_user()
