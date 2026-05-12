# Peticiona — Plataforma de Petições Jurídicas

Sistema web para solicitação, gestão e entrega de serviços jurídicos relacionados a petições (geração, revisão e protocolo), com áreas distintas para **clientes**, **equipe interna (staff)** e **administradores**.

> Site em produção: https://peticionaadv.lovable.app

---

## ✨ Visão geral

O Peticiona conecta clientes (advogados, escritórios e pessoas físicas) a uma equipe jurídica que produz petições sob demanda. O cliente faz um pedido, acompanha o andamento, troca mensagens com a equipe e recebe o documento dentro do prazo contratado.

### Principais funcionalidades

- **Landing page** com apresentação do serviço, planos, FAQ, formulário de contato e chat flutuante.
- **Cadastro e autenticação** com validação forte de senha (maiúscula, minúscula, número, símbolo, mín. 8 caracteres) e indicador de força em tempo real.
- **Aceite de Termos de Uso** versionado — usuários são reapresentados aos termos quando há nova versão.
- **Área do Cliente** (`/client`):
  - Dashboard com resumo de pedidos e saldo.
  - Criação de novos pedidos (geração, revisão, protocolo) com diferentes modalidades (padrão e express).
  - Acompanhamento de pedidos com histórico, comentários e download de arquivos.
  - Compra de créditos via checkout integrado ao **Pagar.me**.
  - Modal de **Ajuda** com contato por e-mail e WhatsApp.
- **Área da Equipe** (`/staff`): gestão dos pedidos atribuídos, status operacional e financeiro.
- **Área Administrativa** (`/admin`):
  - Gestão de clientes, equipe, planos e financeiro.
  - Gestão de pedidos com edição de prazo de entrega (recalcula prazo interno automaticamente).
  - Configuração global de contato (e-mail e WhatsApp) refletida em todo o site.
- **Notificações por e-mail** para `contato@peticiona.app.br` ao criar pedidos ou comentários.
- **Política de Privacidade** e **Termos de Uso** acessíveis via modal no rodapé.

---

## 🧱 Stack técnica

- **React 18** + **Vite 5** + **TypeScript 5**
- **Tailwind CSS v3** com design system baseado em tokens semânticos (HSL)
- **shadcn/ui** (Radix UI) para componentes acessíveis
- **React Router** para navegação
- **TanStack Query** para gerenciamento de dados assíncronos
- **Framer Motion** para animações
- **Lucide Icons**
- **Vitest** para testes unitários

### Integrações previstas

- **Pagar.me** — checkout de créditos/serviços (frontend pronto, backend a implementar).
- **Lovable Cloud / Supabase** — backend gerenciado (autenticação, banco e storage), conforme evolução do projeto.

---

## 📁 Estrutura do projeto

```
src/
├── components/
│   ├── admin/         # Componentes da área administrativa
│   ├── client/        # Componentes da área do cliente
│   ├── staff/         # Componentes da equipe
│   ├── landing/       # Seções da landing page
│   └── ui/            # Componentes shadcn (botões, dialogs, inputs...)
├── lib/               # Lógica de negócio, mocks e utilitários
│   ├── auth.tsx           # Contexto de autenticação
│   ├── pedidos.ts         # CRUD de pedidos (cliente)
│   ├── adminPedidos.ts    # CRUD de pedidos (admin)
│   ├── checkoutApi.ts     # Integração Pagar.me
│   ├── contactInfo.ts     # Contato global (admin-editável)
│   ├── orderEmailNotify.ts# Notificações de pedidos
│   ├── terms.ts           # Versionamento dos Termos de Uso
│   └── ...
├── pages/
│   ├── Index.tsx          # Landing page
│   ├── Auth.tsx           # Login
│   ├── Signup.tsx         # Cadastro
│   ├── Checkout.tsx       # Checkout Pagar.me
│   ├── client/            # Páginas do cliente
│   ├── staff/             # Páginas da equipe
│   └── admin/             # Páginas administrativas
├── hooks/             # Hooks customizados
├── index.css          # Tokens do design system (HSL)
└── main.tsx
```

---

## 🚀 Como rodar localmente

Requisitos: **Node.js 18+** e **npm** (ou bun/pnpm).

```bash
# instalar dependências
npm install

# ambiente de desenvolvimento
npm run dev

# build de produção
npm run build

# rodar testes
npm run test
```

A aplicação inicia em `http://localhost:8080`.

---

## 👥 Perfis de acesso

| Perfil      | Rota base   | Descrição                                          |
|-------------|-------------|----------------------------------------------------|
| Cliente     | `/client`   | Cria pedidos, acompanha status, compra créditos    |
| Equipe      | `/staff`    | Atende pedidos atribuídos                          |
| Admin       | `/admin`    | Gestão completa: clientes, pedidos, planos, equipe |

---

## 🔐 Segurança

- Senhas validadas no cadastro com critérios obrigatórios.
- Termos de Uso versionados (`TERMS_VERSION`) — alteração obriga novo aceite.
- Chaves sensíveis (ex.: Pagar.me) **nunca** ficam expostas no frontend; integrações sensíveis são feitas via backend.
- Papéis de usuário tratados em estrutura separada para evitar escalonamento de privilégios.

---

## 📬 Contato

- **E-mail:** contato@peticiona.app.br
- **WhatsApp:** (11) 97494-0551

Os dados de contato são gerenciados pelo administrador em `/admin/perfil` e refletidos automaticamente no rodapé, formulário de contato e modal de ajuda.

---

## 📄 Licença

Projeto proprietário — Peticiona Serviços Jurídicos. Todos os direitos reservados.
