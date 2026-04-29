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
        cpf: "529.982.247-25",
        phone: "(11) 91234-5678",
      }),
      update: vi.fn().mockResolvedValue({
        id: 1,
        full_name: "Usuário Teste",
        email: "test@test.com",
        oab_number: "SP 123456",
        cpf: "529.982.247-25",
        phone: "(11) 91234-5678",
      }),
      balance: vi.fn().mockResolvedValue({ credits_available: 3 }),
      documents: vi.fn().mockResolvedValue({ documents: [] }),
      terms: vi.fn().mockResolvedValue({
        accepted: true,
        current_version: "1.0.0",
        text_hash: "test-hash",
        acceptance: {
          id: 1,
          version: "1.0.0",
          text_hash: "test-hash",
          accepted_at: "2026-04-01T10:00:00Z",
          ip_address: null,
        },
      }),
      acceptTerms: vi.fn(),
    },
    payments: {
      creditPackages: vi.fn().mockResolvedValue({
        public_key: "pk_test_public",
        dry_run: true,
        packages: [],
      }),
      createCreditOrder: vi.fn(),
    },
    clientArea: {
      orders: vi.fn().mockResolvedValue({ orders: [] }),
      order: vi.fn(),
      previewOrder: vi.fn().mockResolvedValue({
        is_valid: true,
        items: [{ code: "solicitacao-juridica", title: "Solicitação jurídica", quantity: 1, unit_price: 16000, line_total: 16000 }],
        total_amount: 16000,
        total_brl: "R$ 160,00",
      }),
      createOrder: vi.fn(),
      updateOrder: vi.fn(),
      deleteOrder: vi.fn().mockResolvedValue({ deleted: true }),
    },
    documents: {
      upload: vi.fn().mockResolvedValue({ documents: [] }),
      delete: vi.fn().mockResolvedValue({ deleted: true }),
    },
    staff: {
      profile: vi.fn().mockResolvedValue({
        id: 7,
        full_name: "Ana Beatriz Souza",
        email: "ana.souza@peticiona.app.br",
        cpf: "123.456.789-00",
        phone: "(11) 98765-4321",
        role: "staff",
        role_title: "Advogada Sênior",
        employee_code: "PT-EQ-0042",
        oab_number: "SP 345.678",
        zip_code: "01310-100",
        street: "Av. Paulista",
        street_number: "1000",
        address_complement: "Sala 1201",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        is_active: true,
        created_at: "2026-01-10T10:00:00Z",
      }),
      updateProfile: vi.fn().mockResolvedValue({
        id: 99,
        full_name: "Roberto Almeida Pinheiro",
        email: "admin@peticiona.app.br",
        oab_number: "SP 998877",
        role: "admin",
        is_active: true,
        created_at: "2026-01-10T10:00:00Z",
        created_at_label: "10/01/2026",
      }),
      orders: vi.fn().mockResolvedValue({ orders: [] }),
      updateOrder: vi.fn(),
      financial: vi.fn().mockResolvedValue({
        summary: {
          total_orders: 0,
          completed_orders: 0,
          estimated_payout_cents: 0,
          estimated_payout_brl: "R$ 0,00",
        },
        orders: [],
      }),
    },
    admin: {
      profile: vi.fn().mockResolvedValue({
        id: 99,
        full_name: "Roberto Almeida Pinheiro",
        email: "admin@peticiona.app.br",
        oab_number: "SP 998877",
        role: "admin",
        is_active: true,
        created_at: "2026-01-10T10:00:00Z",
        created_at_label: "10/01/2026",
      }),
      updateProfile: vi.fn(),
      orders: vi.fn().mockResolvedValue({
        orders: [
          {
            id: 1,
            numero: "ADM-001",
            user_id: 1,
            cliente: "Marina Costa Almeida",
            petition_id: 501,
            petition: {
              id: 501,
              reference: "PET-000501",
              area_direito: "Cível",
              tipo_peticao: "Petição inicial",
              numero_processo: "5001234-56.2026.8.26.0100",
              data_publicacao: "2026-04-23",
              justica_gratuita: false,
              tutela_urgencia: true,
              advogado_subscritor: "Dra. Marina",
              resumo_caso: "Resumo enviado pelo cliente.",
              detalhes: "Detalhes completos do formulário.",
              status: "pendente",
              status_label: "Pendente",
              created_at: "2026-04-01T10:00:00Z",
              partes: [
                { nome: "Autor Teste", tipo: "autor" },
                { nome: "Réu Teste", tipo: "reu" },
              ],
              documents: [
                { id: 901, file_name: "contrato.pdf", size_label: "120 KB", created_at: "2026-04-01T10:00:00Z" },
              ],
            },
            tipo_servico: "Petição inicial",
            status: "concluido",
            status_label: "Concluído",
            funcionario: "Ana Beatriz",
            prazo_cliente: "10/05/2026",
            valor: 16000,
            valor_brl: "R$ 160,00",
            criado_em: "01/04/2026 10:00",
            finalizado_em: "03/04/2026 10:00",
            split_plataforma: 40,
            split_funcionario: 60,
          },
          {
            id: 2,
            numero: "ADM-002",
            cliente: "Rafael Mendonça",
            tipo_servico: "Contestação",
            status: "pendente",
            status_label: "Em análise",
            funcionario: null,
            prazo_cliente: "11/05/2026",
            valor: 15000,
            valor_brl: "R$ 150,00",
            criado_em: "02/04/2026 10:00",
            finalizado_em: "—",
            split_plataforma: 100,
            split_funcionario: 0,
          },
          {
            id: 3,
            numero: "ADM-003",
            cliente: "Paula Nogueira",
            tipo_servico: "Recurso",
            status: "em_andamento",
            status_label: "Aguardando dados",
            funcionario: "Bruno Lima",
            prazo_cliente: "12/05/2026",
            valor: 23000,
            valor_brl: "R$ 230,00",
            criado_em: "03/04/2026 10:00",
            finalizado_em: "—",
            split_plataforma: 40,
            split_funcionario: 60,
          },
          {
            id: 4,
            numero: "ADM-004",
            cliente: "Caio Torres",
            tipo_servico: "Defesa administrativa",
            status: "concluido",
            status_label: "Concluído",
            funcionario: "Ana Beatriz",
            prazo_cliente: "13/05/2026",
            valor: 20000,
            valor_brl: "R$ 200,00",
            criado_em: "04/04/2026 10:00",
            finalizado_em: "05/04/2026 10:00",
            split_plataforma: 40,
            split_funcionario: 60,
          },
        ],
      }),
      clients: vi.fn().mockResolvedValue({
        clients: [
          {
            id: 1,
            nome: "Rafael Mendonça",
            oab: "SP 123456",
            email: "rafael@test.com",
            telefone: "(11) 99999-0001",
            plano: "Plano Essencial",
            cadastrado_em: "01/01/2026",
            ativo: true,
          },
          {
            id: 2,
            nome: "Marina Costa Almeida",
            oab: "RJ 222333",
            email: "marina@test.com",
            telefone: "(21) 99999-0002",
            plano: "Plano Profissional",
            cadastrado_em: "02/01/2026",
            ativo: true,
          },
          {
            id: 3,
            nome: "Paula Nogueira",
            oab: "MG 444555",
            email: "paula@test.com",
            telefone: "(31) 99999-0003",
            plano: "Plano Estratégico",
            cadastrado_em: "03/01/2026",
            ativo: true,
          },
          {
            id: 4,
            nome: "Caio Torres",
            oab: "PR 666777",
            email: "caio@test.com",
            telefone: "(41) 99999-0004",
            plano: "Sem plano",
            cadastrado_em: "04/01/2026",
            ativo: false,
          },
        ],
      }),
      staff: vi.fn().mockResolvedValue({
        staff: [
          {
            id: 1,
            nome: "Ana Beatriz",
            email: "ana@test.com",
            telefone: "(11) 98888-0001",
            pedidos_ativos: 2,
            pedidos_concluidos: 8,
            ativo: true,
          },
          {
            id: 2,
            nome: "Bruno Lima",
            email: "bruno@test.com",
            telefone: "(11) 98888-0002",
            pedidos_ativos: 1,
            pedidos_concluidos: 4,
            ativo: true,
          },
          {
            id: 3,
            nome: "Juliana Ribeiro",
            email: "juliana@test.com",
            telefone: "(11) 98888-0003",
            pedidos_ativos: 0,
            pedidos_concluidos: 6,
            ativo: false,
          },
        ],
      }),
      financial: vi.fn().mockResolvedValue({
        stats: {
          receita_mes: 74000,
          receita_mes_brl: "R$ 740,00",
          concluidos: 2,
          abertos: 2,
        },
        orders: [],
        entries: [],
      }),
      createFinancialEntry: vi.fn(),
      updateFinancialEntry: vi.fn(),
      deleteFinancialEntry: vi.fn(),
      creditPurchases: vi.fn().mockResolvedValue({
        purchases: [
          {
            id: 10,
            code: "CRED-REFUND-001",
            user_email: "rafael@test.com",
            user_name: "Rafael Mendonça",
            package_name: "Petição Avulsa",
            amount_cents: 16000,
            amount_brl: "R$ 160,00",
            status: "paid",
            pagarme_charge_id: "ch_test_001",
            pagarme_order_id: "or_test_001",
            credited_at: "2026-04-01T10:00:00Z",
            created_at: "2026-04-01T10:00:00Z",
          },
        ],
      }),
      refundCreditPurchase: vi.fn().mockResolvedValue({
        refunded: true,
        gateway_status: "canceled",
        credits_reversed: true,
        message: "Estorno processado com sucesso pela Pagar.me.",
        purchase: {
          id: 10,
          code: "CRED-REFUND-001",
          user_email: "rafael@test.com",
          user_name: "Rafael Mendonça",
          package_name: "Petição Avulsa",
          amount_cents: 16000,
          amount_brl: "R$ 160,00",
          status: "refunded",
          pagarme_charge_id: "ch_test_001",
          pagarme_order_id: "or_test_001",
          credited_at: "2026-04-01T10:00:00Z",
          created_at: "2026-04-01T10:00:00Z",
        },
      }),
      plans: vi.fn().mockResolvedValue({
        plans: [
          {
            id: 1,
            code: "essencial",
            name: "Plano Essencial",
            monthly_price_cents: 9900,
            monthly_price_brl: "R$ 99,00",
            monthly_credits_cents: 54000,
            monthly_credits_brl: "R$ 540,00",
            petition_limit_monthly: 3,
          },
          {
            id: 2,
            code: "profissional",
            name: "Plano Profissional",
            monthly_price_cents: 19900,
            monthly_price_brl: "R$ 199,00",
            monthly_credits_cents: 110000,
            monthly_credits_brl: "R$ 1.100,00",
            petition_limit_monthly: 8,
          },
          {
            id: 3,
            code: "estrategico",
            name: "Plano Estratégico",
            monthly_price_cents: 34900,
            monthly_price_brl: "R$ 349,00",
            monthly_credits_cents: 220000,
            monthly_credits_brl: "R$ 2.200,00",
            petition_limit_monthly: null,
          },
        ],
        single_services: [
          {
            id: 1,
            code: "peticao-inicial",
            section: "Petições",
            title: "Petição inicial",
            description: "Estruturação da peça inicial.",
            unit_price: 18900,
            unit_price_brl: "R$ 189,00",
            is_active: true,
          },
        ],
      }),
      createService: vi.fn(),
      updateService: vi.fn(),
      deleteService: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports pós-mock
// ---------------------------------------------------------------------------
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

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

beforeEach(() => {
  vi.clearAllMocks();
});

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
  });

  it("renderiza heading 'Meus pedidos'", () => {
    renderWithOutlet(ClientLayout, Orders, "/area-cliente", "pedidos", "/area-cliente/pedidos");
    expect(screen.getByRole("heading", { name: /meus pedidos/i })).toBeInTheDocument();
  });

  it("exibe mensagem quando não há pedidos", async () => {
    renderWithOutlet(ClientLayout, Orders, "/area-cliente", "pedidos", "/area-cliente/pedidos");
    expect(await screen.findByText(/nenhum pedido ainda/i)).toBeInTheDocument();
  });

  it("exibe card de histórico conectado ao backend", () => {
    renderWithOutlet(ClientLayout, Orders, "/area-cliente", "pedidos", "/area-cliente/pedidos");
    expect(screen.getByText(/histórico/i)).toBeInTheDocument();
  });

  it("exibe pedidos retornados pela API real do cliente", async () => {
    vi.mocked(api.clientArea.orders).mockResolvedValueOnce({
      orders: [
        {
          id: 101,
          reference: "ORD-000101",
          status: "pendente",
          status_label: "Pendente",
          total_amount: 18000,
          total_brl: "R$ 180,00",
          client_name: "Usuário Teste",
          user_id: 1,
          staff_name: null,
          staff_user_id: null,
          service_type: "Contestação",
          created_at: "2026-04-01T10:00:00Z",
          deadline_at: null,
          completed_at: null,
          items: [],
        },
      ],
    });
    renderWithOutlet(ClientLayout, Orders, "/area-cliente", "pedidos", "/area-cliente/pedidos");
    await waitFor(() => {
      expect(screen.getByText(/contestação/i)).toBeInTheDocument();
    });
  });
});

describe("/area-cliente/saldos — Saldos (READ + CREATE)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
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

  it("exibe saldo R$ 540,00 retornado pela API de saldo", async () => {
    vi.mocked(api.me.balance).mockResolvedValueOnce({
      credits_available: 54000,
      credits_available_cents: 54000,
      credits_available_brl: "R$ 540,00",
      credits_total: 54000,
      credits_total_cents: 54000,
      credits_total_brl: "R$ 540,00",
      credits_used: 0,
      credits_used_cents: 0,
      credits_used_brl: "R$ 0,00",
      movements: [],
    });
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

  it("atualiza perfil do cliente chamando somente api.me.update", async () => {
    renderWithOutlet(ClientLayout, Account, "/area-cliente", "conta", "/area-cliente/conta");
    fireEvent.change(await screen.findByLabelText(/e-mail/i), {
      target: { value: "cliente.novo@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/telefone/i), {
      target: { value: "(11) 98888-7777" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() => {
      expect(api.me.update).toHaveBeenCalledWith({
        email: "cliente.novo@test.com",
        phone: "(11) 98888-7777",
      });
    });
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

  it("campos imutáveis exibem dados do backend mockado (CPF)", async () => {
    renderWithOutlet(StaffLayout, StaffProfile, "/area-interna", "perfil", "/area-interna/perfil");
    expect(await screen.findByDisplayValue("123.456.789-00")).toBeDisabled();
  });

  it("campo e-mail é editável (UPDATE)", async () => {
    renderWithOutlet(StaffLayout, StaffProfile, "/area-interna", "perfil", "/area-interna/perfil");
    expect(await screen.findByDisplayValue("ana.souza@peticiona.app.br")).not.toBeDisabled();
  });

  it("botão 'Salvar alterações' está presente", async () => {
    renderWithOutlet(StaffLayout, StaffProfile, "/area-interna", "perfil", "/area-interna/perfil");
    expect(await screen.findByRole("button", { name: /salvar alterações/i })).toBeInTheDocument();
  });
});

describe("/area-interna/pedidos — Bandeja de pedidos (READ + UPDATE)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
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

  it("exibe mensagem quando bandeja está vazia", async () => {
    renderWithOutlet(
      StaffLayout,
      StaffOrders,
      "/area-interna",
      "pedidos",
      "/area-interna/pedidos",
    );
    expect(await screen.findByText(/nenhum pedido na bandeja/i)).toBeInTheDocument();
  });
});

describe("/area-interna/financeiro — Financeiro funcionário (READ)", () => {
  beforeEach(() => {
    mockAuthAuthenticated();
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

  it("exibe mensagem quando não há pedidos para o funcionário", async () => {
    renderWithOutlet(
      StaffLayout,
      StaffFinancial,
      "/area-interna",
      "financeiro",
      "/area-interna/financeiro",
    );
    expect(await screen.findByText(/nenhum pedido encontrado/i)).toBeInTheDocument();
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

  it("campos imutáveis do admin estão desabilitados", async () => {
    renderWithOutlet(AdminLayout, AdminProfile, "/admin", "perfil", "/admin/perfil");
    expect(await screen.findByDisplayValue("Administrador")).toBeDisabled();
  });

  it("campo e-mail do admin é editável (UPDATE)", async () => {
    renderWithOutlet(AdminLayout, AdminProfile, "/admin", "perfil", "/admin/perfil");
    expect(await screen.findByDisplayValue("admin@peticiona.app.br")).not.toBeDisabled();
  });

  it("atualiza perfil do administrador chamando somente api.admin.updateProfile", async () => {
    renderWithOutlet(AdminLayout, AdminProfile, "/admin", "perfil", "/admin/perfil");
    fireEvent.change(await screen.findByLabelText(/nome completo/i), {
      target: { value: "Admin Produção" },
    });
    fireEvent.change(screen.getByLabelText(/^oab$/i), {
      target: { value: "SP 111222" },
    });
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: "admin.prod@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() => {
      expect(api.admin.updateProfile).toHaveBeenCalledWith({
        full_name: "Admin Produção",
        email: "admin.prod@test.com",
        oab_number: "SP 111222",
      });
    });
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

  it("exibe CTA de criação e pedidos carregados do backend", async () => {
    render(
      <Wrapper path="/admin/pedidos">
        <AdminOrders />
      </Wrapper>,
    );
    expect(screen.getByRole("button", { name: /novo pedido/i })).toBeInTheDocument();
    expect(await screen.findByText(/nº adm-001/i)).toBeInTheDocument();
  });

  it("exibe cliente Marina Costa Almeida", async () => {
    render(
      <Wrapper path="/admin/pedidos">
        <AdminOrders />
      </Wrapper>,
    );
    expect(await screen.findByText("Marina Costa Almeida")).toBeInTheDocument();
  });

  it("abre detalhes completos do formulário vinculado ao pedido", async () => {
    render(
      <Wrapper path="/admin/pedidos">
        <AdminOrders />
      </Wrapper>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /ver detalhes do pedido adm-001/i }));
    expect(await screen.findByText(/detalhes do formulário/i)).toBeInTheDocument();
    expect(screen.getByText("Resumo enviado pelo cliente.")).toBeInTheDocument();
    expect(screen.getByText("Autor Teste")).toBeInTheDocument();
    expect(screen.getByText("contrato.pdf")).toBeInTheDocument();
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

  it("exibe contagem de 4 clientes", async () => {
    render(
      <Wrapper path="/admin/clientes">
        <AdminClients />
      </Wrapper>,
    );
    expect(await screen.findByText(/4 clientes cadastrados/i)).toBeInTheDocument();
  });

  it("exibe cliente Rafael Mendonça", async () => {
    render(
      <Wrapper path="/admin/clientes">
        <AdminClients />
      </Wrapper>,
    );
    expect(await screen.findByText("Rafael Mendonça")).toBeInTheDocument();
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

  it("exibe 3 funcionários cadastrados", async () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    expect(await screen.findByText(/3 funcionários cadastrados/i)).toBeInTheDocument();
  });

  it("f1 (Ana Beatriz) aparece ativo", async () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    expect((await screen.findAllByText(/^ativo$/i)).length).toBeGreaterThan(0);
  });

  it("f3 (Juliana Ribeiro) aparece bloqueado", async () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    expect(await screen.findByText("Juliana Ribeiro")).toBeInTheDocument();
    expect(screen.getByText(/^bloqueado$/i)).toBeInTheDocument();
  });

  it("expõe ações reais de bloqueio e reativação", async () => {
    render(
      <Wrapper>
        <AdminStaff />
      </Wrapper>,
    );
    const lockButtons = await screen.findAllByLabelText(/bloquear funcionário/i);
    lockButtons.forEach((button) => expect(button).toBeEnabled());
    expect(screen.getByLabelText(/reativar funcionário/i)).toBeEnabled();
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

  it("exibe valor de receita total (R$ 740,00 = soma dos 4 mocks)", async () => {
    render(
      <Wrapper>
        <AdminFinancial />
      </Wrapper>,
    );
    // 160 + 150 + 230 + 200 = 740; pode aparecer mais de uma vez (stat + tabela)
    const matches = await screen.findAllByText(/740/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("exibe compras de crédito com ação de estorno total", async () => {
    render(
      <Wrapper>
        <AdminFinancial />
      </Wrapper>,
    );
    expect(await screen.findByText("CRED-REFUND-001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /estornar total/i })).toBeEnabled();
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

  it("exibe os três planos mensais", async () => {
    render(
      <Wrapper>
        <AdminPlans />
      </Wrapper>,
    );
    expect(await screen.findByText(/plano essencial/i)).toBeInTheDocument();
    expect(screen.getByText(/plano profissional/i)).toBeInTheDocument();
    expect(screen.getByText(/plano estratégico/i)).toBeInTheDocument();
  });

  it("expõe ações de CRUD para planos e serviços", async () => {
    render(
      <Wrapper>
        <AdminPlans />
      </Wrapper>,
    );
    expect(await screen.findByRole("button", { name: /novo plano/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /novo serviço/i })).toBeInTheDocument();
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
