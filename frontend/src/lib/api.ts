export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  oab_number: string | null;
  cpf?: string | null;
  phone?: string | null;
  role?: "admin" | "staff" | "client" | string;
  company_id?: number | null;
  is_active?: boolean;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  oab_number: string;
  cpf: string;
  phone: string;
  oab_uf?: string;
  password: string;
  confirm_password: string;
}

export interface BalanceData {
  credits_available: number;
  credits_available_cents?: number;
  credits_available_brl?: string;
  credits_total: number;
  credits_total_cents?: number;
  credits_total_brl?: string;
  credits_used: number;
  credits_used_cents?: number;
  credits_used_brl?: string;
  movements: {
    type: "in" | "out";
    amount: number;
    amount_cents?: number;
    amount_brl?: string;
    description: string;
    date: string;
    source?: "plano" | "avulso" | "mix";
  }[];
}

export interface AdminProfile {
  id: number;
  full_name: string;
  email: string;
  oab_number: string | null;
  cpf?: string | null;
  phone?: string | null;
  role: string;
  role_title?: string | null;
  employee_code?: string | null;
  zip_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  is_active: boolean;
  created_at: string;
  created_at_label: string;
}

export interface AdminOrder {
  id: number;
  numero: string;
  user_id: number | null;
  cliente: string;
  petition_id?: number | null;
  petition?: Petition | null;
  staff_user_id: number | null;
  tipo_servico: string;
  status: string;
  status_label: string;
  funcionario: string | null;
  prazo_cliente: string;
  prazo_cliente_iso?: string | null;
  valor: number;
  valor_brl: string;
  criado_em: string;
  finalizado_em: string;
  finalizado_em_iso?: string | null;
  split_plataforma: number;
  split_funcionario: number;
}

export interface AdminClient {
  id: number;
  nome: string;
  oab: string;
  email: string;
  telefone: string;
  plano: string;
  cadastrado_em: string;
  ativo: boolean;
}

export interface AdminStaffMember {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  pedidos_ativos: number;
  pedidos_concluidos: number;
  ativo: boolean;
}

export interface AdminFinancialData {
  stats: {
    receita_mes: number;
    receita_mes_brl: string;
    concluidos: number;
    abertos: number;
  };
  orders: AdminOrder[];
  entries?: FinancialEntry[];
}

export interface FinancialEntry {
  id: number;
  description: string;
  kind: "credit" | "debit" | string;
  amount_cents: number;
  amount_brl: string;
  occurred_at: string;
  occurred_at_label: string;
  order_id: number | null;
  is_active: boolean;
}

export interface AdminCreditPurchase {
  id: number;
  code: string;
  user_email: string | null;
  user_name: string | null;
  package_name: string;
  amount_cents: number;
  amount_brl: string;
  status: "processing" | "pending" | "paid" | "failed" | "refunded" | string;
  pagarme_charge_id?: string | null;
  pagarme_order_id?: string | null;
  credited_at?: string | null;
  created_at: string;
}

export interface AdminCreditPurchaseRefund {
  refunded: boolean;
  purchase: AdminCreditPurchase;
  gateway_status: string;
  credits_reversed: boolean;
  message: string;
}

export interface AdminPlansData {
  plans: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    monthly_price_cents: number;
    monthly_price_brl: string;
    monthly_credits_cents: number;
    monthly_credits_brl: string;
    petition_limit_monthly: number | null;
    is_active: boolean;
  }[];
  single_services: {
    id: number;
    code: string;
    section: string;
    title: string;
    description?: string | null;
    unit_price: number;
    unit_price_brl: string;
    is_active: boolean;
  }[];
}

export type AdminService = AdminPlansData["single_services"][number];

export interface CreditPackage {
  id: string;
  name: string;
  kind: "plan" | "single";
  source: "plano" | "avulso";
  amount_cents: number;
  amount_brl: string;
  credit_cents: number;
  credit_brl: string;
  description: string;
}

export interface CreditPaymentConfig {
  public_key: string;
  dry_run: boolean;
  packages: CreditPackage[];
}

export interface SmokeChargePayload {
  method: "credit_card" | "pix";
  card_token?: string;
  customer: { document: string; phone: string };
  billing_address?: {
    street: string; number: string; neighborhood: string;
    city: string; state: string; zip_code: string; complement?: string;
  };
}

export interface SmokeChargeResult {
  id: string;
  code: string;
  status: string;
  amount: number;
  charges: {
    id: string;
    status: string;
    amount?: number;
    last_transaction?: {
      id: string;
      status: string;
      success?: boolean;
      qr_code?: string;
      qr_code_url?: string;
      expires_at?: string;
      antifraud_response?: { status: string };
    };
  }[];
}

export interface CreditOrderPayload {
  package_id: string;
  idempotency_key: string;
  card_token: string;
  customer: {
    document: string;
    phone: string;
  };
  billing_address: {
    zip_code: string;
    street: string;
    number: string;
    neighborhood: string;
    complement?: string;
    city: string;
    state: string;
  };
  antifraud: {
    session_id: string;
    device: {
      platform: string;
    };
    location?: {
      latitude: string;
      longitude: string;
    };
  };
}

export interface CreditOrderResponse {
  purchase: {
    id: number;
    code: string;
    package_id: string;
    package_name: string;
    kind: "plan" | "single";
    source: "plano" | "avulso";
    amount_cents: number;
    amount_brl: string;
    credit_cents: number;
    credit_brl: string;
    status: "processing" | "pending" | "paid" | "failed" | string;
    paid: boolean;
    credited: boolean;
    pagarme_order_id?: string | null;
    antifraud_status?: string | null;
  };
}

export interface CheckoutOrder {
  id: number;
  user_id: number;
  service_id: string;
  service_name: string | null;
  amount: number;
  amount_brl: string;
  currency: "BRL" | string;
  status: "pending" | "processing" | "paid" | "failed" | "canceled" | "refunded" | string;
  paid: boolean;
  released: boolean;
  pagarme_order_id?: string | null;
  pagarme_charge_id?: string | null;
  created_at: string;
  updated_at: string;
  paid_at?: string | null;
  released_at?: string | null;
}

export interface CheckoutPaymentPayload {
  order_id: number;
  idempotency_key?: string;
  card_token: string;
  customer: CreditOrderPayload["customer"];
  billing_address: CreditOrderPayload["billing_address"];
  antifraud: CreditOrderPayload["antifraud"];
}

export interface Petition {
  id: number;
  reference: string;
  area_direito: string;
  tipo_peticao: string | null;
  numero_processo: string | null;
  data_publicacao?: string | null;
  justica_gratuita?: boolean;
  tutela_urgencia?: boolean;
  advogado_subscritor?: string | null;
  resumo_caso?: string | null;
  detalhes?: string | null;
  status: string;
  status_label: string;
  created_at: string;
  partes?: { nome: string; tipo: string }[];
  documents?: UploadedDocument[];
}

export interface PetitionPayload {
  area_direito: string;
  tipo_peticao: string;
  numero_processo: string;
  data_publicacao: string;
  justica_gratuita: boolean;
  tutela_urgencia: boolean;
  advogado_subscritor: string;
  resumo_caso: string;
  detalhes: string;
  partes: { nome: string; tipo: string }[];
  document_ids: number[];
  deadline_at?: string;
  service_code?: string;
}

export interface ClientOrder {
  id: number;
  reference: string;
  status: string;
  status_label: string;
  total_amount: number;
  total_brl: string;
  client_name?: string | null;
  user_id?: number | null;
  petition_id?: number | null;
  petition?: Petition | null;
  staff_name?: string | null;
  staff_user_id?: number | null;
  service_type: string;
  created_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
  items: {
    code: string;
    title: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}

export interface StaffProfile {
  id: number;
  full_name: string;
  email: string;
  cpf?: string | null;
  phone?: string | null;
  role: string;
  role_title?: string | null;
  employee_code?: string | null;
  oab_number?: string | null;
  zip_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StaffFinancialData {
  summary: {
    total_orders: number;
    completed_orders: number;
    estimated_payout_cents: number;
    estimated_payout_brl: string;
  };
  orders: ClientOrder[];
}

export interface UploadedDocument {
  id: number;
  file_name: string;
  size_label: string;
  created_at: string;
}

export interface TermsAcceptanceData {
  accepted: boolean;
  current_version: string;
  text_hash: string;
  acceptance: {
    id: number;
    version: string;
    text_hash: string;
    accepted_at: string;
    ip_address?: string | null;
  } | null;
}

export interface ClientOrderPreview {
  is_valid: boolean;
  items: ClientOrder["items"];
  total_amount: number;
  total_brl: string;
}

export interface DashboardData {
  user: { name: string; role: string };
  selected_filter: string;
  filters: { value: string; label: string }[];
  stats: {
    pendente: number;
    em_andamento: number;
    concluido: number;
    revenue_brl: string;
  };
  services: {
    reference: string;
    title: string;
    client_name: string;
    status: string;
    status_label: string;
    deadline: string;
    service_type: string;
    value_brl: string;
  }[];
}

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorPayload = data as { error?: string; message?: string };
    throw new Error(errorPayload.message || errorPayload.error || "Erro inesperado.");
  }
  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (payload: RegisterPayload) =>
      request<{ token: string; user: AuthUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  me: {
    get: () => request<AuthUser>("/me"),
    update: (data: Partial<Pick<AuthUser, "full_name" | "oab_number" | "email" | "phone">>) =>
      request<AuthUser>("/me", { method: "PATCH", body: JSON.stringify(data) }),
    balance: () => request<BalanceData>("/me/balance"),
    documents: () => request<{ documents: UploadedDocument[] }>("/me/documents"),
    terms: () => request<TermsAcceptanceData>("/me/terms"),
    acceptTerms: () => request<TermsAcceptanceData>("/me/terms", { method: "POST" }),
  },

  payments: {
    creditPackages: () => request<CreditPaymentConfig>("/payments/credit-packages"),
    createCreditOrder: (payload: CreditOrderPayload) =>
      request<CreditOrderResponse>("/payments/credit-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    smokeCharge: (payload: SmokeChargePayload) =>
      request<SmokeChargeResult>("/payments/smoke-charge", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  checkout: {
    createOrder: (serviceId: string, idempotencyKey?: string) =>
      request<{ order: CheckoutOrder }>("/checkout/create-order", {
        method: "POST",
        body: JSON.stringify({
          service_id: serviceId,
          idempotency_key: idempotencyKey,
        }),
      }),
    createPayment: (payload: CheckoutPaymentPayload) =>
      request<{ order: CheckoutOrder }>("/checkout/create-payment", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    status: (orderId: number) => request<{ order: CheckoutOrder }>(`/checkout/status/${orderId}`),
  },

  dashboard: {
    get: (status?: string) =>
      request<DashboardData>(`/dashboard${status ? `?status=${status}` : ""}`),
  },

  admin: {
    profile: () => request<AdminProfile>("/admin/profile"),
    updateProfile: (data: Partial<Pick<AdminProfile, "full_name" | "email" | "oab_number">>) =>
      request<AdminProfile>("/admin/profile", { method: "PUT", body: JSON.stringify(data) }),
    orders: () => request<{ orders: AdminOrder[] }>("/admin/orders"),
    createOrder: (payload: Record<string, unknown>) =>
      request<{ order: AdminOrder }>("/admin/orders", { method: "POST", body: JSON.stringify(payload) }),
    updateOrder: (id: number, payload: Record<string, unknown>) =>
      request<{ order: AdminOrder }>(`/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    updateOrderStatus: (id: number, status: string) =>
      request<{ order: AdminOrder }>(`/admin/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    deleteOrder: (id: number) => request<Record<string, never>>(`/admin/orders/${id}`, { method: "DELETE" }),
    clients: () => request<{ clients: AdminClient[] }>("/admin/clients"),
    createClient: (payload: Record<string, unknown>) =>
      request<{ client: AdminClient }>("/admin/clients", { method: "POST", body: JSON.stringify(payload) }),
    updateClient: (id: number, payload: Record<string, unknown>) =>
      request<{ client: AdminClient }>(`/admin/clients/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    deleteClient: (id: number) => request<Record<string, never>>(`/admin/clients/${id}`, { method: "DELETE" }),
    staff: () => request<{ staff: AdminStaffMember[] }>("/admin/staff"),
    createStaff: (payload: Record<string, unknown>) =>
      request<{ staff_member: AdminStaffMember }>("/admin/staff", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateStaff: (id: number, payload: Record<string, unknown>) =>
      request<{ staff_member: AdminStaffMember }>(`/admin/staff/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteStaff: (id: number) => request<Record<string, never>>(`/admin/staff/${id}`, { method: "DELETE" }),
    financial: () => request<AdminFinancialData>("/admin/financial"),
    financialTransactions: () => request<Pick<AdminFinancialData, "entries">>("/admin/financial/transactions"),
    createFinancialRefund: (payload: Record<string, unknown>) =>
      request<{ refund: FinancialEntry }>("/admin/financial/refund", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    creditPurchases: () => request<{ purchases: AdminCreditPurchase[] }>("/admin/credit-purchases"),
    refundCreditPurchase: (id: number) =>
      request<AdminCreditPurchaseRefund>(`/admin/credit-purchases/${id}/refund`, {
        method: "POST",
      }),
    createFinancialEntry: (payload: Record<string, unknown>) =>
      request<{ entry: FinancialEntry }>("/admin/financial/entries", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateFinancialEntry: (id: number, payload: Record<string, unknown>) =>
      request<{ entry: FinancialEntry }>(`/admin/financial/entries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteFinancialEntry: (id: number) =>
      request<{ deleted: boolean }>(`/admin/financial/entries/${id}`, { method: "DELETE" }),
    plans: () => request<AdminPlansData>("/admin/plans"),
    createPlan: (payload: Record<string, unknown>) =>
      request<{ plan: AdminPlansData["plans"][number] }>("/admin/plans", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updatePlan: (id: number, payload: Record<string, unknown>) =>
      request<{ plan: AdminPlansData["plans"][number] }>(`/admin/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deletePlan: (id: number) => request<Record<string, never>>(`/admin/plans/${id}`, { method: "DELETE" }),
    createService: (payload: Record<string, unknown>) =>
      request<{ service: AdminService }>("/admin/services", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateService: (id: number, payload: Record<string, unknown>) =>
      request<{ service: AdminService }>(`/admin/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteService: (id: number) => request<Record<string, never>>(`/admin/services/${id}`, { method: "DELETE" }),
  },

  petitions: {
    list: () => request<{ petitions: Petition[] }>("/petitions"),
    create: (payload: PetitionPayload) =>
      request<{ message: string; petition: Petition; order: ClientOrder }>("/petitions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  documents: {
    upload: (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append("documents", f));
      return request<{ documents: UploadedDocument[] }>("/client-area/documents", {
        method: "POST",
        body: form,
      });
    },
    delete: (id: number) => request<{ deleted: boolean }>(`/client-area/documents/${id}`, { method: "DELETE" }),
  },

  clientArea: {
    orders: () => request<{ orders: ClientOrder[] }>("/client-area/orders"),
    order: (id: number) => request<{ order: ClientOrder }>(`/client-area/orders/${id}`),
    previewOrder: (payload: Record<string, unknown>) =>
      request<ClientOrderPreview>("/client-area/orders/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    createOrder: (payload: Record<string, unknown>) =>
      request<{ message: string; order: ClientOrder }>("/client-area/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateOrder: (id: number, payload: Record<string, unknown>) =>
      request<{ order: ClientOrder }>(`/client-area/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteOrder: (id: number) =>
      request<{ deleted: boolean; order: ClientOrder }>(`/client-area/orders/${id}`, { method: "DELETE" }),
  },

  staff: {
    profile: () => request<StaffProfile>("/staff/profile"),
    updateProfile: (payload: Partial<StaffProfile>) =>
      request<StaffProfile>("/staff/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    orders: () => request<{ orders: ClientOrder[] }>("/staff/orders"),
    updateOrder: (id: number, payload: Record<string, unknown>) =>
      request<{ order: ClientOrder }>(`/staff/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    financial: () => request<StaffFinancialData>("/staff/financial"),
  },
};
