#!/usr/bin/env python3
"""
Verifica se as senhas no banco de dados estão criptografadas
"""

import sys
import os

# Adicionar o diretório app ao Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import User

def check_password_hashes():
    """Verifica se as senhas estão criptografadas no banco"""
    app = create_app()
    
    with app.app_context():
        print("🔍 Verificando criptografia de senhas no banco...")
        print("=" * 60)
        
        # Buscar todos os usuários
        users = User.query.all()
        
        if not users:
            print("❌ Nenhum usuário encontrado no banco!")
            return False
        
        print(f"📊 Total de usuários: {len(users)}")
        print()
        
        encrypted_count = 0
        plain_text_count = 0
        suspicious_count = 0
        
        for user in users:
            password_hash = user.password_hash
            is_encrypted = True
            hash_type = "Desconhecido"
            
            # Verificar características de hash
            if not password_hash:
                hash_type = "VAZIO"
                suspicious_count += 1
                is_encrypted = False
            elif password_hash.startswith("pbkdf2:"):
                hash_type = "PBKDF2 (Werkzeug)"
                encrypted_count += 1
            elif password_hash.startswith("scrypt:"):
                hash_type = "SCRYPT (Werkzeug)"
                encrypted_count += 1
            elif password_hash.startswith("sha256$"):
                hash_type = "SHA256 (Werkzeug)"
                encrypted_count += 1
            elif len(password_hash) < 20:
                hash_type = "TEXTO PLANO (suspeito)"
                plain_text_count += 1
                is_encrypted = False
            elif password_hash.lower() in ["senha", "password", "123456", "admin"]:
                hash_type = "SENHA COMUM (suspeito)"
                suspicious_count += 1
                is_encrypted = False
            elif any(char in password_hash for char in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"):
                # Se contém letras comuns, pode ser texto plano
                if not any(char in password_hash for char in "$.:/"):
                    hash_type = "TEXTO PLANO (suspeito)"
                    plain_text_count += 1
                    is_encrypted = False
                else:
                    hash_type = "HASH (provavelmente)"
                    encrypted_count += 1
            else:
                hash_type = "HASH (provavelmente)"
                encrypted_count += 1
            
            # Exibir informações do usuário
            status = "✅" if is_encrypted else "❌"
            print(f"{status} {user.full_name} ({user.email})")
            print(f"   📧 Email: {user.email}")
            print(f"   🔑 Função: {user.role}")
            print(f"   🔒 Hash: {hash_type}")
            print(f"   📏 Tamanho: {len(password_hash)} caracteres")
            
            # Mostrar primeiros caracteres do hash (para verificação)
            if len(password_hash) > 10:
                preview = password_hash[:20] + "..."
            else:
                preview = password_hash
            print(f"   👁️ Preview: {preview}")
            print()
        
        # Resumo
        print("=" * 60)
        print("📊 RESUMO DA ANÁLISE:")
        print(f"   ✅ Criptografadas: {encrypted_count}")
        print(f"   ❌ Texto plano: {plain_text_count}")
        print(f"   ⚠️ Suspeitas: {suspicious_count}")
        print(f"   📊 Total: {len(users)}")
        
        # Calcular percentual
        if len(users) > 0:
            encrypted_percentage = (encrypted_count / len(users)) * 100
            print(f"   📈 Percentual criptografado: {encrypted_percentage:.1f}%")
        
        # Verificar se está seguro
        is_secure = plain_text_count == 0 and suspicious_count == 0
        
        print()
        if is_secure:
            print("🎉 RESULTADO: SEGURANÇA DE SENHAS OK!")
            print("   ✅ Todas as senhas estão criptografadas")
            print("   ✅ Nenhuma senha em texto plano")
            print("   ✅ Nenhuma senha suspeita")
            print("   ✅ Sistema seguro contra vazamento de senhas")
        else:
            print("🚨 RESULTADO: PROBLEMA DE SEGURANÇA!")
            print("   ❌ Existem senhas em texto plano")
            print("   ❌ Existem senhas suspeitas")
            print("   ❌ Risco de segurança")
            print("   🔧 Ação necessária: corrigir senhas")
        
        # Análise do método de criptografia
        print()
        print("🔍 ANÁLISE DO MÉTODO DE CRIPTOGRAFIA:")
        print("   📚 Biblioteca: Werkzeug Security")
        print("   🔧 Função: generate_password_hash()")
        print("   🔐 Verificação: check_password_hash()")
        print("   🛡️ Algoritmo: PBKDF2, SCRYPT ou SHA256 (Werkzeug)")
        print("   📏 Comprimento: 255 caracteres no banco")
        print("   🔒 Campo: password_hash (String 255)")
        
        return is_secure

if __name__ == "__main__":
    result = check_password_hashes()
    exit(0 if result else 1)
