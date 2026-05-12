# Clone do Repositório - Peticiona Serviços Jurídicos

**Data do Clone:** 7 de maio de 2026  
**Método:** Download via GitHub Raw API (sem Git)  
**Status:** ✅ Sucesso

## 📁 Estrutura Clonada

```
Peticiona-Servicos-juridicos-main/
├── backend/                      # Backend Python/Flask
│   ├── app/
│   │   ├── core/               # Extensões e configurações
│   │   │   ├── __init__.py
│   │   │   ├── extensions.py
│   │   │   └── errors.py
│   │   ├── domain/             # Lógica de domínio
│   │   │   ├── __init__.py
│   │   │   └── permissions.py
│   │   ├── models/             # Modelos do banco
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── credits.py      # 🔑 Modelo de transações
│   │   │   └── order.py
│   │   ├── services/           # Lógica de negócio
│   │   │   ├── audit_service.py
│   │   │   ├── checkout_service.py  # 🔑 Pagamentos e webhooks
│   │   │   ├── client_area_service.py  # 🔑 Gestão de saldos
│   │   │   ├── pagarme_service.py  # 🔑 Integração Pagar.me
│   │   │   └── serializers.py
│   │   └── __init__.py
│   ├── run.py                  # Entrada do backend
│   └── requirements.txt         # Dependências Python
├── src/                        # Frontend TypeScript/React
│   ├── main.tsx
│   ├── App.tsx
│   └── index.css
├── index.html                  # Raiz do frontend
├── package.json               # Dependências Node.js
├── tsconfig.json              # TypeScript
├── vite.config.ts            # Vite build
├── tailwind.config.ts        # TailwindCSS
├── eslint.config.js          # Linter
├── Dockerfile                # Imagem Docker
├── docker-compose.yml        # Compose (se existir)
├── nginx.conf               # Configuração Nginx
├── .gitignore              # Git ignore
├── .env.example            # Variáveis de ambiente exemplo
├── README.md               # Documentação original
└── CLONE_INFO.md          # Este arquivo
```

## 🔑 Arquivos Mais Importantes para Análise

| Arquivo | Descrição |
|---------|-----------|
| `backend/app/models/credits.py` | Modelo de transações de crédito |
| `backend/app/services/checkout_service.py` | Lógica de pagamento e webhook |
| `backend/app/services/client_area_service.py` | Validação e gestão de saldos |
| `backend/app/services/pagarme_service.py` | Integração com Pagar.me |
| `package.json` | Dependências do projeto |
| `backend/requirements.txt` | Dependências Python |

## 📊 Análise de Saldos

Uma análise completa foi feita em:  
**`/home/andre-kaique/projetos/ANALISE_SALDOS_BACKEND.md`**

### Resultado: ✅ 80% Implementado Corretamente

**Conformidade com Fluxo de Saldos:**
- ✅ Créditos adicionados apenas após webhook do Pagar.me
- ✅ Validação de saldo antes de criar pedido
- ✅ Débito automático ao criar pedido
- ✅ Rastreamento completo de transações

**Problemas Identificados:**
- ❌ Estorno não remove saldo (CRÍTICO)
- ❌ Saldo pode ficar negativo (ALTO)
- ⚠️ Falta rastreamento de status (MÉDIO)

## 🔄 Como Usar

### Backend (Python/Flask)

```bash
# Entrar no diretório backend
cd backend

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp ../.env.example .env
# Editar .env com suas configurações

# Rodar servidor
python run.py
```

### Frontend (TypeScript/Vite)

```bash
# Na raiz do projeto
npm install
npm run dev
```

### Docker

```bash
# Usar docker-compose
docker-compose up

# Ou construir imagem manualmente
docker build -t peticiona .
docker run -p 5000:5000 -p 3000:3000 peticiona
```

## 📝 Notas

- ⚠️ Este é um **clone parcial** com arquivos principais
- ⚠️ Alguns diretórios podem estar incompletos (como `/src/components/`)
- ✅ Todos os arquivos críticos de análise foram baixados
- ✅ Pronto para implementação das correções sugeridas

## 🛠️ Próximos Passos

1. **Revisar** `ANALISE_SALDOS_BACKEND.md` para entender os problemas
2. **Implementar** reversão de saldo em estornos
3. **Adicionar** validação de saldo negativo
4. **Expandir** modelo CreditTransaction com novos campos
5. **Testar** webhook de estorno

## 📞 Referências

- **Repositório Original:** https://github.com/AndrekaiqueDevjunior/Peticiona-Servicos-juridicos
- **Análise Completa:** `/home/andre-kaique/projetos/ANALISE_SALDOS_BACKEND.md`
- **Data:** 7 de maio de 2026

---

*Clone criado automaticamente via GitHub Raw API*
