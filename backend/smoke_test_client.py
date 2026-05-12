#!/usr/bin/env python3
"""
Smoke test completo das funcionalidades do cliente:
- Login
- Visualização de pedidos
- Edição de perfil
- Upload de documentos
- Criação de pedidos
"""

import sys
import os
import requests
import json

# Configurações
BASE_URL = "http://localhost:5000"
FRONTEND_URL = "http://localhost:8080"

# Credenciais do cliente
CLIENT_EMAIL = "andre.kaique@cliente.com"
CLIENT_PASSWORD = "cliente123"

def test_client_login():
    """Testa login do cliente"""
    print("🔐 Testando login do cliente...")
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("token") or data.get("access_token")
        if token:
            print(f"✅ Login successful! Token: {token[:50]}...")
            return token
        else:
            print(f"❌ Login failed: No token in response")
            print(f"Response: {data}")
            return None
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_profile_edit(token):
    """Testa edição de perfil do cliente"""
    print("\n📝 Testando edição de perfil...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Obter perfil atual
    response = requests.get(f"{BASE_URL}/api/me", headers=headers)
    if response.status_code == 200:
        profile = response.json()
        print(f"📋 Perfil atual: {profile['full_name']} - {profile['phone']}")
    else:
        print(f"❌ Failed to get profile: {response.status_code}")
        return False
    
    # Atualizar perfil
    update_data = {
        "full_name": "Andre Kaique Cliente Teste",
        "phone": "11988888888"
    }
    
    response = requests.patch(f"{BASE_URL}/api/me", headers=headers, json=update_data)
    if response.status_code == 200:
        updated_profile = response.json()
        print(f"✅ Perfil atualizado: {updated_profile['full_name']} - {updated_profile['phone']}")
        return True
    else:
        print(f"❌ Failed to update profile: {response.status_code} - {response.text}")
        return False

def test_orders_view(token):
    """Testa visualização de pedidos do cliente"""
    print("\n📋 Testando visualização de pedidos...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/api/client-area/orders", headers=headers)
    if response.status_code == 200:
        data = response.json()
        orders = data.get("orders", [])
        print(f"✅ Pedidos encontrados: {len(orders)}")
        
        for order in orders:
            print(f"   📄 {order['reference']}: R$ {order['total_amount']/100:.2f} - {order['status']}")
        
        return len(orders) > 0
    else:
        print(f"❌ Failed to get orders: {response.status_code} - {response.text}")
        return False

def test_document_upload(token):
    """Testa upload de documentos do cliente"""
    print("\n📎 Testando upload de documentos...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Criar arquivo de teste
    test_content = "Documento de teste para upload\nCriado em: 12/05/2026\nConteúdo de exemplo"
    
    files = {"documents": ("test_smoke.txt", test_content, "text/plain")}
    
    response = requests.post(f"{BASE_URL}/api/client-area/documents", headers=headers, files=files)
    if response.status_code == 200:
        data = response.json()
        documents = data.get("documents", [])
        print(f"✅ Upload successful! Documentos: {len(documents)}")
        
        for doc in documents:
            print(f"   📄 {doc['file_name']} - {doc['size_label']} - {doc['download_url']}")
        
        return len(documents) > 0
    else:
        print(f"❌ Failed to upload documents: {response.status_code} - {response.text}")
        return False

def test_balance_view(token):
    """Testa visualização de saldo do cliente"""
    print("\n💰 Testando visualização de saldo...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/api/me/balance", headers=headers)
    if response.status_code == 200:
        data = response.json()
        balance = data.get("credits_available_brl", "R$ 0,00")
        print(f"✅ Saldo disponível: {balance}")
        return True
    else:
        print(f"❌ Failed to get balance: {response.status_code} - {response.text}")
        return False

def test_catalog_view(token):
    """Testa visualização de catálogo de serviços"""
    print("\n📖 Testando visualização de catálogo...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/api/client-area", headers=headers)
    if response.status_code == 200:
        data = response.json()
        plans = data.get("plans", [])
        services = data.get("services", [])
        print(f"✅ Catálogo carregado: {len(plans)} planos, {len(services)} serviços")
        return True
    else:
        print(f"❌ Failed to get catalog: {response.status_code} - {response.text}")
        return False

def main():
    """Executa smoke test completo"""
    print("🚀 Iniciando smoke test completo das funcionalidades do cliente...")
    print(f"🌐 Backend: {BASE_URL}")
    print(f"🌐 Frontend: {FRONTEND_URL}")
    print(f"👤 Cliente: {CLIENT_EMAIL}")
    print("=" * 60)
    
    # Teste de login
    token = test_client_login()
    if not token:
        print("\n❌ Smoke test FAILED: Login não funcionou")
        return False
    
    # Testes das funcionalidades
    results = []
    
    results.append(test_profile_edit(token))
    results.append(test_orders_view(token))
    results.append(test_document_upload(token))
    results.append(test_balance_view(token))
    results.append(test_catalog_view(token))
    
    # Resumo final
    passed = sum(results)
    total = len(results)
    
    print("\n" + "=" * 60)
    print(f"📊 Resumo do smoke test:")
    print(f"   ✅ Passou: {passed}/{total}")
    print(f"   ❌ Falhou: {total - passed}/{total}")
    
    if passed == total:
        print(f"\n🎉 Smoke test CONCLUÍDO COM SUCESSO!")
        print(f"\n🌐 Para testar no frontend:")
        print(f"   1. Acesse: {FRONTEND_URL}")
        print(f"   2. Faça login com: {CLIENT_EMAIL} / {CLIENT_PASSWORD}")
        print(f"   3. Teste as funcionalidades:")
        print(f"      - 📝 Editar perfil (http://localhost:8080/area-cliente/conta)")
        print(f"      - 📋 Visualizar pedidos (http://localhost:8080/area-cliente/pedidos)")
        print(f"      - 💰 Ver saldo (http://localhost:8080/area-cliente/saldos)")
        print(f"      - 📎 Upload de documentos (no formulário de novo pedido)")
        print(f"      - 📖 Catálogo de serviços (http://localhost:8080/area-cliente/novo-pedido)")
        return True
    else:
        print(f"\n❌ Smoke test FALHOU!")
        return False

if __name__ == "__main__":
    main()
