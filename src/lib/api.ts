export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  oab_number: string | null;
  role?: "admin" | "staff" | "client" | string;
  company_id?: number | null;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  oab_number: string;
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
  status: string;
  status_label: string;
  created_at: string;
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
}

export interface UploadedDocument {
  id: number;
  file_name: string;
  size_label: string;
  created_at: string;
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
    update: (data: Partial<Pick<AuthUser, "full_name" | "oab_number">>) =>
      request<AuthUser>("/me", { method: "PUT", body: JSON.stringify(data) }),
    balance: () => request<BalanceData>("/me/balance"),
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

  petitions: {
    list: () => request<{ petitions: Petition[] }>("/petitions"),
    create: (payload: PetitionPayload) =>
      request<{ message: string; petition: Petition }>("/petitions", {
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
  },
};
