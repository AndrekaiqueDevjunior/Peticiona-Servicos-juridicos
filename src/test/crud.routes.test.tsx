/**
 * CRUD — Smoke tests e testes de proteção de rotas
 *
 * Estratégia:
 *  - vi.mock('@/lib/auth')  → controla isAuthenticated por teste
 *  - vi.mock('@/lib/api')   → evita chamadas HTTP reais
 *  - Cada rota renderizada individualmente com QueryClientProvider + MemoryRouter
 *  - _resetForTest() nos stores garante isolamento de estado entre testes
 */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks de módulos externos (devem vir antes dos imports das páginas)
// ---------------------------------------------------------------------------
// Evita que TermsAcceptanceDialog abra e bloqueie aria-hidden no conteúdo
vi.mock("@/lib/terms", () => ({
  TERMS_VERSION: "1.0.0",
  useTermsAcceptance: vi.fn(() => ({
    version: "1.0.0",
    acceptedAt: new Date().toISOString(),
    ip: null,
  })),
  acceptTerms: vi.fn(),
  hasAcceptedCurrentTerms: vi.fn(() => true),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AuthContext: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> },
}));

vi.mock("@/lib/api", () => ({
  api: {
    dashboard: {
      get: vi.fn().mockResolvedValue({
        stats: { pendente: 2, em_andamento: 1, concluido: 5 },
        services: [],
      }),
    },
    me: {
      get: vi.fn().mockResolvedValue({
        id: 1,
        full_name: "Usuário Teste",
        email: "test@test.com",
        oab_number: "SP 123456",
      }),
      balance: vi.fn().mockResolvedValue({ credits_available: 3 }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports pós-mock
// ---------------------------------------------------------------------------
import { useAuth } from "@/lib/auth";
import { _resetForTest as resetPedidos } from "@/lib/pedidos";
import { _resetForTest as resetBalance, assinarPlano } from "@/lib/balance";

import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";

import ClientLayout from "@/pages/client/ClientLayout";
import Dashboard from "@/pages/client/Dashboard";
import Orders from "@/pages/client/Orders";
import Balance from "@/pages/client/Balance";
import Account from "@/pages/client/Account";

import StaffLayout from "@/pages/staff/StaffLayout";
import StaffProfile from "@/pages/staff/Profile";
import StaffOrders from "@/pages/staff/StaffOrders";
import StaffFinancial from "@/pages/staff/Financial";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminProfile from "@/pages/admin/AdminProfile";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminClients from "@/pages/admin/AdminClients";
import AdminStaff from "@/pages/admin/AdminStaff";
import AdminFinancial from "@/pages/admin/AdminFinancial";
import AdminPlans from "@/pages/admin/AdminPlans";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MOCK_USER = {
  id: 1,
  full_name: "Usuário Teste",
  email: "test@test.com",
  oab_number: "SP 123456",
};

const mockAuthAuthenticated = () => {
  vi.mocked(useAuth).mockReturnValue({
    user: MOCK_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
};

const mockAuthUnauthenticated = () => {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
};

const mkQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function Wrapper({ children, path = "/" }: { children: React.ReactNode; path?: string }) {
  return (
    <QueryClientProvider client={mkQueryClient()}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

/** Renderiza layout com <Outlet> + página filha na rota correta. */
function renderWithOutlet(
  Layout: React.ComponentType,
  Page: React.ComponentType,
  layoutPath: string,
  pagePath: string,
  fullPath: string,
) {
  return render(
    <QueryClientProvider client={mkQueryClient()}>
      <MemoryRouter initialEntries={[fullPath]}>
        <Routes>
          <Route path={layoutPath} element={<Layout />}>
            {pagePath ? (
              <Route path={pagePath} element={<Page />} />
            ) : (
              <Route index element={<Page />} />
            )}
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** ProtectedRoute local — espelho do App.tsx para testes de guarda. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// 1. PÚBLICAS
// ---------------------------------------------------------------------------
describe("/ — Landing page (READ)", () => {
  it("renderiza sem erros e exibe algum conteúdo", () => {
    mockAuthUnauthenticated();
    render(
      <Wrapper>
        <Index />
      </Wrapper>,
    );
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
});

describe("/auth — Login (CREATE)", () => {
  beforeEach(() => mockAuthUnauthenticated());

  it("renderiza o formulário de login", () => {
    render(
      <Wrapper path="/auth">
        <Auth />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("exibe estado de loading ao submeter", async () => {
    const loginMock = vi.fn(() => new Promise(() => {})); // nunca resolve
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: loginMock,
      register: vi.fn(),
      logout: vi.fn(),
    });
    render(
      <Wrapper path="/auth">
        <Auth />
      </Wrapper>,
    );
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: "senha123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /aguarde/i })).toBeInTheDocument(),
    );
  });

  it("link 'Criar agora' leva para /cadastro", () => {
    render(
      <Wrapper path="/auth">
        <Auth />
      </Wrapper>,
    );
    expect(screen.getByRole("link", { name: /criar agora/i })).toHaveAttribute(
      "href",
      "/cadastro",
    );
  });
});

describe("/cadastro — Cadastro (CREATE)", () => {
  beforeEach(() => mockAuthUnauthenticated());

  it("renderiza todos os campos obrigatórios", () => {
    render(
      <Wrapper path="/cadastro">
        <Signup />
      </Wrapper>,
    );
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpf/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeInTheDocument();
  });

  it("exibe erros de validação ao submeter com campos vazios", async () => {
    render(
      <Wrapper path="/cadastro">
        <Signup />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    await waitFor(() => {
      const errors = document.querySelectorAll(".text-destructive");
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it("link 'Entrar' leva para /auth", () => {
    render(
      <Wrapper path="/cadastro">
        <Signup />
      </Wrapper>,
    );
    expect(screen.getByRole("link", { name: /entrar/i })).toHaveAttribute("href", "/auth");
  });
});

// ---------------------------------------------------------------------------
// 2. PROTEÇÃO DE ROTAS
// ---------------------------------------------------------------------------
describe("ProtectedRoute — guarda de autenticação", () => {
  it("redireciona para /auth quando não autenticado", () => {
    mockAuthUnauthenticated();
    render(
      <QueryClientProvider client={mkQueryClient()}>
        <MemoryRouter initialEntries={["/area-cliente"]}>
          <Routes>
            <Route
              path="/area-cliente"
              element={
                <ProtectedRoute>
                  <div>Área do Cliente</div>
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<div>Página de Login</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Página de Login")).toBeInTheDocument();
    expect(screen.queryByText("Área do Cliente")).not.toBeInTheDocument();
  });

  it("renderiza conteúdo quando autenticado", () => {
    mockAuthAuthenticated();
    render(
      <QueryClientProvider client={mkQueryClient()}>
        <MemoryRouter initialEntries={["/area-cliente"]}>
          <Routes>
            <Route
              path="/area-cliente"
              element={
                <ProtectedRoute>
                  <div>Área do Cliente</div>
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<div>Página de Login</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Área do Cliente")).toBeInTheDocument();
    expect(screen.queryByText("Página de Login")).not.toBeInTheDocument();
  });

  it("retorna null durante isLoading (sem flash de redirect)", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    const { container } = render(
      <QueryClientProvider client={mkQueryClient()}>
        <MemoryRouter initialEntries={["/area-cliente"]}>
          <Routes>
            <Route
              path="/area-cliente"
              element={
                <ProtectedRoute>
                  <div>Área do Cliente</div>
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. CLIENTE — /area-cliente
// ---------------------------------------------------------------------------
describe("/area-cliente — Dashboard (READ)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
    resetPedidos();
    resetBalance();
  });

  it("renderiza heading de boas-vindas com o nome do usuário", async () => {
    renderWithOutlet(ClientLayout, Dashboard, "/area-cliente", "", "/area-cliente");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /olá, usuário/i })).toBeInTheDocument();
    });
  });

  it("renderiza cards de estatísticas", async () => {
    renderWithOutlet(ClientLayout, Dashboard, "/area-cliente", "", "/area-cliente");
    await waitFor(() => {
      expect(screen.getByText(/aguardando análise/i)).toBeInTheDocument();
      expect(screen.getByText(/concluídos/i)).toBeInTheDocument();
      expect(screen.getByText(/saldo disponível/i)).toBeInTheDocument();
    });
  });
});

describe("/area-cliente/pedidos — Pedidos cliente (READ + UPDATE)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
    resetPedidos();
  });

  it("renderiza heading 'Meus pedidos'", () => {
    renderWithOutlet(ClientLayout, Orders, "/area-cliente", "pedidos", "/area-cliente/pedidos");
    expect(screen.getByRole("heading", { name: /meus pedidos/i })).toBeInTheDocument();
  });

  it("exibe mensagem quando não há pedidos", () => {
    renderWithOutlet(ClientLayout, Orders, "/area-cliente", "pedidos", "/area-cliente/pedidos");
    expect(screen.getByText(/nenhum pedido ainda/i)).toBeInTheDocument();
  });

  it("filtros de status estão presentes", () => {
    renderWithOutlet(ClientLayout, Orders, "/area-cliente", "pedidos", "/area-cliente/pedidos");
    expect(screen.getByText(/filtros/i)).toBeInTheDocument();
  });

  it("cria pedido no store e exibe na lista (READ após CREATE)", async () => {
    const { criarPedido } = await import("@/lib/pedidos");
    criarPedido({
      areaDireito: "Cível",
      tipoPeticao: "Contestação",
      numeroProcesso: "0001-55.2025",
      dataPublicacao: "",
      competencia: "Estadual",
      comarca: "SP",
      justicaGratuita: false,
      tutelaUrgencia: false,
      advogadoSubscritor: "Dr. Teste",
      resumoCaso: "Caso teste",
      detalhes: "Detalhes",
      partes: [],
      anexosOriginais: [],
      modalidadeLabel: "Avulso",
      valor: 180,
    });
    renderWithOutlet(ClientLayout, Orders, "/area-cliente", "pedidos", "/area-cliente/pedidos");
    await waitFor(() => {
      expect(screen.getByText(/cível/i)).toBeInTheDocument();
    });
  });
});

describe("/area-cliente/saldos — Saldos (READ + CREATE)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
    resetBalance();
  });

  it("renderiza heading 'Meus saldos'", () => {
    renderWithOutlet(ClientLayout, Balance, "/area-cliente", "saldos", "/area-cliente/saldos");
    expect(screen.getByRole("heading", { name: /meus saldos/i })).toBeInTheDocument();
  });

  it("exibe saldo R$ 0,00 por padrão (pelo menos uma ocorrência)", () => {
    renderWithOutlet(ClientLayout, Balance, "/area-cliente", "saldos", "/area-cliente/saldos");
    const matches = screen.getAllByText(/R\$\s*0,00/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("botão 'Comprar mais créditos' está no DOM", () => {
    renderWithOutlet(ClientLayout, Balance, "/area-cliente", "saldos", "/area-cliente/saldos");
    // Busca por conteúdo de texto (não role) pois o botão tem ícone SVG antes do texto
    expect(screen.getByText(/comprar mais créditos/i)).toBeInTheDocument();
  });

  it("exibe saldo R$ 540,00 após assinatura de plano (CREATE crédito)", async () => {
    assinarPlano("essencial"); // usa mesma instância de módulo que Balance
    renderWithOutlet(ClientLayout, Balance, "/area-cliente", "saldos", "/area-cliente/saldos");
    await waitFor(() => {
      const matches = screen.getAllByText(/540/);
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});

describe("/area-cliente/conta — Minha conta (READ + UPDATE)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
    resetPedidos();
  });

  it("renderiza heading 'Minha conta'", () => {
    renderWithOutlet(ClientLayout, Account, "/area-cliente", "conta", "/area-cliente/conta");
    expect(screen.getByRole("heading", { name: /minha conta/i })).toBeInTheDocument();
  });

  it("botão 'Salvar alterações' está presente", () => {
    renderWithOutlet(ClientLayout, Account, "/area-cliente", "conta", "/area-cliente/conta");
    expect(screen.getByRole("button", { name: /salvar alterações/i })).toBeInTheDocument();
  });

  it("campo e-mail é editável", () => {
    renderWithOutlet(ClientLayout, Account, "/area-cliente", "conta", "/area-cliente/conta");
    const emailInput = screen.getByLabelText(/e-mail/i);
    expect(emailInput).not.toBeDisabled();
  });

  it("card de segurança está presente", () => {
    renderWithOutlet(ClientLayout, Account, "/area-cliente", "conta", "/area-cliente/conta");
    expect(screen.getByText(/segurança/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. FUNCIONÁRIO — /area-interna
// ---------------------------------------------------------------------------
describe("/area-interna/perfil — Perfil funcionário (READ + UPDATE)", () => {
  beforeEach(() => mockAuthAuthenticated());

  it("renderiza heading 'Meu perfil'", () => {
    renderWithOutlet(StaffLayout, StaffProfile, "/area-interna", "perfil", "/area-interna/perfil");
    expect(screen.getByRole("heading", { name: /meu perfil/i })).toBeInTheDocument();
  });

  it("campos imutáveis exibem dados do mock (nome, CPF)", () => {
    renderWithOutlet(StaffLayout, StaffProfile, "/area-interna", "perfil", "/area-interna/perfil");
    expect(screen.getByDisplayValue("Ana Beatriz Souza")).toBeDisabled();
    expect(screen.getByDisplayValue("123.456.789-00")).toBeDisabled();
  });

  it("campo e-mail é editável (UPDATE)", () => {
    renderWithOutlet(StaffLayout, StaffProfile, "/area-interna", "perfil", "/area-interna/perfil");
    expect(screen.getByDisplayValue("ana.souza@peticiona.app.br")).not.toBeDisabled();
  });

  it("botão 'Salvar alterações' está presente", () => {
    renderWithOutlet(StaffLayout, StaffProfile, "/area-interna", "perfil", "/area-interna/perfil");
    expect(screen.getByRole("button", { name: /salvar alterações/i })).toBeInTheDocument();
  });
});

describe("/area-interna/pedidos — Bandeja de pedidos (READ + UPDATE)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
    resetPedidos();
  });

  it("renderiza heading 'Bandeja de pedidos'", () => {
    renderWithOutlet(
      StaffLayout,
      StaffOrders,
      "/area-interna",
      "pedidos",
      "/area-interna/pedidos",
    );
    expect(screen.getByRole("heading", { name: /bandeja de pedidos/i })).toBeInTheDocument();
  });

  it("exibe mensagem quando bandeja está vazia", () => {
    renderWithOutlet(
      StaffLayout,
      StaffOrders,
      "/area-interna",
      "pedidos",
      "/area-interna/pedidos",
    );
    expect(screen.getByText(/nenhum pedido na bandeja/i)).toBeInTheDocument();
  });
});

describe("/area-interna/financeiro — Financeiro funcionário (READ)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
    resetPedidos();
  });

  it("renderiza heading 'Financeiro'", () => {
    renderWithOutlet(
      StaffLayout,
      StaffFinancial,
      "/area-interna",
      "financeiro",
      "/area-interna/financeiro",
    );
    expect(screen.getByRole("heading", { name: /^financeiro$/i })).toBeInTheDocument();
  });

  it("exibe mensagem quando não há pedidos para o filtro", () => {
    renderWithOutlet(
      StaffLayout,
      StaffFinancial,
      "/area-interna",
      "financeiro",
      "/area-interna/financeiro",
    );
    expect(screen.getByText(/nenhum pedido encontrado/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. ADMIN — /admin
// ---------------------------------------------------------------------------
describe("/admin/perfil — Perfil admin (READ + UPDATE)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
    localStorage.setItem("peticiona:role:v1", "admin");
  });

  it("renderiza heading 'Meu perfil'", () => {
    renderWithOutlet(AdminLayout, AdminProfile, "/admin", "perfil", "/admin/perfil");
    expect(screen.getByRole("heading", { name: /meu perfil/i })).toBeInTheDocument();
  });

  it("campos imutáveis do admin estão desabilitados", () => {
    renderWithOutlet(AdminLayout, AdminProfile, "/admin", "perfil", "/admin/perfil");
    expect(screen.getByDisplayValue("Roberto Almeida Pinheiro")).toBeDisabled();
  });

  it("campo e-mail do admin é editável (UPDATE)", () => {
    renderWithOutlet(AdminLayout, AdminProfile, "/admin", "perfil", "/admin/perfil");
    expect(screen.getByDisplayValue("admin@peticiona.app.br")).not.toBeDisabled();
  });
});

describe("/admin/pedidos — Todos os pedidos (READ)", () => {
  beforeEach(() => mockAuthAuthenticated());

  it("renderiza heading 'Todos os pedidos'", () => {
    render(
      <Wrapper path="/admin/pedidos">
        <AdminOrders />
      </Wrapper>,
    );
    expect(screen.getByRole("heading", { name: /todos os pedidos/i })).toBeInTheDocument();
  });

  it("exibe contador de pedidos (4 pedidos mock)", () => {
    render(
      <Wrapper path="/admin/pedidos">
        <AdminOrders />
      </Wrapper>,
    );
    expect(screen.getByText(/4 pedidos/i)).toBeInTheDocument();
  });

  it("exibe cliente Marina Costa Almeida", () => {
    render(
      <Wrapper path="/admin/pedidos">
        <AdminOrders />
      </Wrapper>,
    );
    expect(screen.getByText("Marina Costa Almeida")).toBeInTheDocument();
  });
});

describe("/admin/clientes — Clientes (READ)", () => {
  beforeEach(() => mockAuthAuthenticated());

  it("renderiza heading 'Clientes'", () => {
    render(
      <Wrapper path="/admin/clientes">
        <AdminClients />
      </Wrapper>,
    );
    expect(screen.getByRole("heading", { name: /^clientes$/i })).toBeInTheDocument();
  });

  it("exibe contagem de 4 clientes", () => {
    render(
      <Wrapper path="/admin/clientes">
        <AdminClients />
      </Wrapper>,
    );
    expect(screen.getByText(/4 clientes cadastrados/i)).toBeInTheDocument();
  });

  it("exibe cliente Rafael Mendonça", () => {
    render(
      <Wrapper path="/admin/clientes">
        <AdminClients />
      </Wrapper>,
    );
    expect(screen.getByText("Rafael Mendonça")).toBeInTheDocument();
  });
});

describe("/admin/funcionarios — Funcionários (READ + UPDATE)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
    localStorage.clear();
  });

  it("renderiza heading 'Funcionários'", () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    expect(screen.getByRole("heading", { name: /^funcionários$/i })).toBeInTheDocument();
  });

  it("exibe 3 funcionários cadastrados", () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    expect(screen.getByText(/3 funcionários cadastrados/i)).toBeInTheDocument();
  });

  it("f1 (Ana Beatriz) aparece ativo", () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    expect(screen.getAllByText(/^ativo$/i).length).toBeGreaterThan(0);
  });

  it("f3 (Juliana Ribeiro) aparece bloqueado", () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    expect(screen.getByText("Juliana Ribeiro")).toBeInTheDocument();
    expect(screen.getByText(/^bloqueado$/i)).toBeInTheDocument();
  });

  it("(UPDATE) clique em bloquear abre AlertDialog de confirmação", async () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    const lockButtons = screen.getAllByLabelText(/bloquear acesso/i);
    fireEvent.click(lockButtons[0]);
    await waitFor(() =>
      expect(screen.getByText(/bloquear acesso do funcionário/i)).toBeInTheDocument(),
    );
  });

  it("(UPDATE) confirmar bloqueio persiste no localStorage", async () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    const lockButtons = screen.getAllByLabelText(/bloquear acesso/i);
    fireEvent.click(lockButtons[0]);
    await waitFor(() => screen.getByRole("button", { name: /^bloquear$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^bloquear$/i }));
    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem("peticiona:staff:status:v1") ?? "{}",
      );
      const hasBlocked = Object.values(stored).some((v) => v === false);
      expect(hasBlocked).toBe(true);
    });
  });
});

describe("/admin/financeiro — Financeiro admin (READ)", () => {
  beforeEach(() => mockAuthAuthenticated());

  it("renderiza heading 'Financeiro'", () => {
    render(
      <Wrapper>
        <AdminFinancial />
      </Wrapper>,
    );
    expect(screen.getByRole("heading", { name: /^financeiro$/i })).toBeInTheDocument();
  });

  it("exibe card de pedidos concluídos", () => {
    render(
      <Wrapper>
        <AdminFinancial />
      </Wrapper>,
    );
    expect(screen.getByText(/pedidos concluídos/i)).toBeInTheDocument();
  });

  it("exibe valor de receita total (R$ 740,00 = soma dos 4 mocks)", () => {
    render(
      <Wrapper>
        <AdminFinancial />
      </Wrapper>,
    );
    // 160 + 150 + 230 + 200 = 740 — pode aparecer mais de uma vez (stat + tabela)
    const matches = screen.getAllByText(/740/);
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe("/admin/planos — Planos e preços (READ)", () => {
  beforeEach(() => mockAuthAuthenticated());

  it("renderiza heading 'Planos e preços'", () => {
    render(
      <Wrapper>
        <AdminPlans />
      </Wrapper>,
    );
    expect(screen.getByRole("heading", { name: /planos e preços/i })).toBeInTheDocument();
  });

  it("exibe os três planos mensais", () => {
    render(
      <Wrapper>
        <AdminPlans />
      </Wrapper>,
    );
    expect(screen.getByText(/plano essencial/i)).toBeInTheDocument();
    expect(screen.getByText(/plano profissional/i)).toBeInTheDocument();
    expect(screen.getByText(/plano estratégico/i)).toBeInTheDocument();
  });

  it("todos os inputs de valor estão desabilitados (somente leitura)", () => {
    render(
      <Wrapper>
        <AdminPlans />
      </Wrapper>,
    );
    const inputs = screen.getAllByRole("textbox");
    inputs.forEach((input) => expect(input).toBeDisabled());
  });
});

// ---------------------------------------------------------------------------
// 6. FALLBACK — 404
// ---------------------------------------------------------------------------
describe("* — NotFound (404)", () => {
  it("renderiza página 404 em rota desconhecida", () => {
    render(
      <Wrapper path="/rota-que-nao-existe">
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Wrapper>,
    );
    expect(document.body.textContent?.toLowerCase()).toMatch(/404|não encontrada|not found/);
  });
});
