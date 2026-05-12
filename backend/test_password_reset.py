#!/usr/bin/env python3
"""
Teste completo do fluxo de reset de senha para identificar problemas
"""

import sys
import os
import requests
import json

# Configurações
BASE_URL = "http://localhost:5000"

def test_password_reset_request():
    """Testa solicitação de reset de senha"""
    print("🔍 Testando solicitação de reset de senha...")
    
    # Testar com email existente
    response = requests.post(f"{BASE_URL}/api/auth/password-reset/request", json={
        "email": "admin@teste.com"
    })
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Solicitação aceita: {data.get('message')}")
        return True
    else:
        print(f"❌ Erro na solicitação: {response.status_code}")
        return False

def test_password_reset_confirm():
    """Testa confirmação de reset de senha"""
    print("\n🔍 Testando confirmação de reset de senha...")
    
    # Gerar token de teste (simulação)
    test_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"
    
    response = requests.post(f"{BASE_URL}/api/auth/password-reset/confirm", json={
        "token": test_token,
        "password": "NovaSenha123!"
    })
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Reset confirmado: {data.get('message')}")
        return True
    else:
        print(f"❌ Erro na confirmação: {response.status_code}")
        return False

def test_email_configuration():
    """Verifica configuração de email"""
    print("\n🔍 Verificando configuração de email...")
    
    try:
        from app import create_app
        app = create_app()
        
        with app.app_context():
            config = app.config
            
            print("📧 Configurações de Email:")
            print(f"   SENDGRID_API_KEY: {'✅ Configurado' if config.get('SENDGRID_API_KEY') else '❌ Não configurado'}")
            print(f"   SMTP_HOST: {'✅ Configurado' if config.get('SMTP_HOST') else '❌ Não configurado'}")
            print(f"   SMTP_PORT: {config.get('SMTP_PORT', 'Não configurado')}")
            print(f"   SMTP_USERNAME: {'✅ Configurado' if config.get('SMTP_USERNAME') else '❌ Não configurado'}")
            print(f"   FRONTEND_URL: {config.get('FRONTEND_URL', 'http://localhost:8080')}")
            print(f"   PASSWORD_RESET_TOKEN_TTL: {config.get('PASSWORD_RESET_TOKEN_TTL_SECONDS', 3600)} segundos")
            
            # Verificar se algum serviço de email está configurado
            has_sendgrid = bool(config.get('SENDGRID_API_KEY'))
            has_smtp = bool(config.get('SMTP_HOST'))
            
            if has_sendgrid or has_smtp:
                print(f"\n✅ Serviço de email configurado:")
                if has_sendgrid:
                    print(f"   📡 SendGrid: API key presente")
                if has_smtp:
                    print(f"   📡 SMTP: {config.get('SMTP_HOST')}:{config.get('SMTP_PORT')}")
                return True
            else:
                print(f"\n❌ NENHUM serviço de email configurado!")
                print(f"   🔧 Configure SENDGRID_API_KEY ou SMTP_HOST")
                print(f"   🔧 Sem email, o reset não funciona")
                return False
                
    except Exception as e:
        print(f"❌ Erro ao verificar configuração: {e}")
        return False

def test_frontend_reset_page():
    """Verifica se a página de reset existe no frontend"""
    print("\n🔍 Verificando página de reset no frontend...")
    
    try:
        response = requests.get("http://localhost:8080/reset-password", timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Página de reset encontrada")
            return True
        else:
            print("❌ Página de reset não encontrada")
            return False
    except requests.exceptions.RequestException:
        print("❌ Frontend não está rodando ou página não existe")
        return False

def main():
    """Executa testes completos do reset de senha"""
    print("🚀 TESTE COMPLETO DO FLUXO DE RESET DE SENHA")
    print("=" * 60)
    
    results = []
    
    # Teste 1: Configuração de email
    results.append(test_email_configuration())
    
    # Teste 2: Solicitação de reset
    results.append(test_password_reset_request())
    
    # Teste 3: Confirmação de reset
    results.append(test_password_reset_confirm())
    
    # Teste 4: Página do frontend
    results.append(test_frontend_reset_page())
    
    # Resumo
    passed = sum(results)
    total = len(results)
    
    print("\n" + "=" * 60)
    print(f"📊 RESUMO DOS TESTES:")
    print(f"   ✅ Passaram: {passed}/{total}")
    print(f"   ❌ Falharam: {total - passed}/{total}")
    
    if passed == total:
        print(f"\n🎉 Todos os testes passaram! Reset de senha funcionando.")
    else:
        print(f"\n❌ Alguns testes falharam. Reset de senha com problemas.")
        
        print(f"\n🔧 POSSÍVEIS PROBLEMAS:")
        if not results[0]:  # Email não configurado
            print(f"   🔧 Email não configurado - configure SENDGRID_API_KEY ou SMTP")
        if not results[3]:  # Frontend não encontrado
            print(f"   🔧 Página de reset não encontrada no frontend")
        if not results[1]:  # Solicitação falhou
            print(f"   🔧 Endpoint de solicitação com erro")
        if not results[2]:  # Confirmação falhou
            print(f"   🔧 Endpoint de confirmação com erro")
    
    return passed == total

if __name__ == "__main__":
    result = main()
    exit(0 if result else 1)
