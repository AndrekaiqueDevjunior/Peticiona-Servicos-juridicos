export type BackendRole = "client" | "staff" | "admin" | (string & {});

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  oab_number: string | null;
  cpf: string | null;
  phone: string | null;
  role: BackendRole;
  company_id: number | null;
  is_active: boolean;
  role_title: string | null;
  employee_code: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  active_plan_id?: number | null;
  created_at?: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  oab_number: string;
  cpf: string;
  phone: string;
  password: string;
  confirm_password: string;
}

export interface BalanceMovement {
  type: "in" | "out";
  amount: number;
  amount_cents: number;
  amount_brl: string;
  kind: "common" | "legacy_cents";
  description: string;
  source: string | null;
  date: string;
}

export interface CreditKindTotals {
  credits_in: number;
  credits_out: number;
  balance: number;
}

export interface BalanceData {
  // Legacy fields (common/créditos comuns only) — maintained for backwards compatibility
  credits_available: number;
  credits_available_cents: number;
  credits_available_brl: string;
  credits_total: number;
  credits_total_cents: number;
  credits_total_brl: string;
  credits_used: number;
  credits_used_cents: number;
  credits_used_brl: string;
  balances: {
    common: number;
  };
  totals_by_kind: {
    common: CreditKindTotals;
  };
  // All transactions (including legacy_cents) with kind field
  movements: BalanceMovement[];
}

export interface UploadedDocument {
  id: number;
  file_name: string;
  size_label: string;
  created_at: string;
  download_url: string;
}

export interface OrderComment {
  id: number;
  order_id: number;
  author_id: number;
  author_name: string;
  author_role: string;
  text: string;
  created_at: string;
}

export interface PetitionParty {
  nome: string;
  tipo: string;
}

export interface Petition {
  id: number;
  reference: string;
  area_direito: string;
  tipo_peticao: string | null;
  numero_processo: string | null;
  data_publicacao: string | null;
  competencia: string | null;
  comarca_uf: string | null;
  justica_gratuita: boolean;
  tutela_urgencia: boolean;
  advogado_subscritor: string | null;
  resumo_caso: string | null;
  detalhes: string | null;
  status: string;
  status_label: string;
  created_at: string;
  partes: PetitionParty[];
  documents: UploadedDocument[];
}

export interface PetitionPayload {
  area_direito: string;
  tipo_peticao: string;
  numero_processo: string;
  data_publicacao: string;
  competencia?: string;
  comarca_uf?: string;
  justica_gratuita: boolean;
  tutela_urgencia: boolean;
  advogado_subscritor: string;
  resumo_caso: string;
  detalhes: string;
  partes: PetitionParty[];
  document_ids: number[];
  express_upgrade?: boolean;
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

export interface TermsAcceptanceResponse {
  accepted: boolean;
  current_version: string;
  text_hash: string;
  acceptance: {
    id: number;
    version: string;
    text_hash: string;
    accepted_at: string;
    ip_address: string | null;
    user_agent: string | null;
  } | null;
}

export interface PublicPlan {
  code: string;
  name: string;
  description: string | null;
  subtitle: string | null;
  monthly_price_cents: number;
  monthly_price_brl: string;
  price_cents: number;
  price_formatted: string;
  petition_limit_monthly: number | null;
  monthly_credits_cents: number;
  price_per_service_cents: number | null;
  unit_price_cents: number | null;
  unit_price_formatted: string | null;
  credits_quantity: number | null;
  validity_days: number | null;
  delivery_label: string | null;
  badge: string | null;
  sort_order: number;
  benefits: string[];
  features: string[];
  is_highlighted: boolean;
  is_active: boolean;
  cta_label: string | null;
}

export interface CatalogService {
  code: string;
  section: string;
  name: string;
  title: string;
  description: string | null;
  price_cents: number;
  price_formatted: string;
  unit_price: number;
  unit_price_brl: string;
  delivery_label: string | null;
  is_active: boolean;
}

export interface FullCatalog {
  plans: PublicPlan[];
  services: CatalogService[];
  catalog: CatalogSection[];
}

export interface CatalogItemLookup {
  type: "plan" | "service";
  item: PublicPlan | CatalogService;
}

export interface ClientOrder {
  id: number;
  reference: string;
  service_type: string;
  status: string;
  status_label: string;
  total_amount: number;
  total_brl: string;
  deadline_at: string | null;
  created_at: string;
  completed_at: string | null;
  petition: Petition | null;
  express_upgrade: boolean;
  express_order_id: number | null;
  items: { code: string; title: string; quantity: number; unit_price: number; line_total: number }[];
}

export const ADMIN_ORDER_STATUSES = [
  "pendente",
  "em_andamento",
  "concluido",
  "cancelado",
] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export function isAdminOrderStatus(status: unknown): status is AdminOrderStatus {
  return typeof status === "string" && ADMIN_ORDER_STATUSES.includes(status as AdminOrderStatus);
}

export const STAFF_ORDER_STATUSES = ["pendente", "em_andamento", "concluido"] as const;

export type StaffOrderStatus = (typeof STAFF_ORDER_STATUSES)[number];

export function isStaffOrderStatus(status: unknown): status is StaffOrderStatus {
  return typeof status === "string" && STAFF_ORDER_STATUSES.includes(status as StaffOrderStatus);
}

export interface AdminOrder {
  id: number;
  numero: string;
  user_id: number | null;
  cliente: string;
  tipo_servico: string;
  status: AdminOrderStatus;
  status_label: string;
  staff_user_id: number | null;
  funcionario: string | null;
  prazo_cliente: string | null;
  prazo_cliente_iso: string | null;
  valor: number;
  valor_brl: string;
  criado_em: string;
  criado_em_iso: string | null;
  finalizado_em: string | null;
  finalizado_em_iso: string | null;
  split_plataforma: number | null;
  split_funcionario: number | null;
  petition: Petition | null;
}

export interface StaffOrder {
  id: number;
  reference: string;
  status: AdminOrderStatus;
  status_label: string;
  client_name: string | null;
  user_id: number | null;
  petition_id: number | null;
  petition: Petition | null;
  staff_name: string | null;
  staff_user_id: number | null;
  service_type: string;
  created_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
  split_funcionario: number;
  staff_payout_cents: number;
  staff_payout_brl: string;
  items: { code: string; title: string; quantity: number; unit_price: number; line_total: number }[];
}

export interface AdminPlan extends PublicPlan {
  id: number;
  monthly_credits_brl?: string;
  price_per_service_cents: number | null;
  features: string[];
  is_active: boolean;
}

export interface AdminServiceCatalogItem {
  id: number;
  code: string;
  section: string;
  title: string;
  description: string | null;
  unit_price: number;
  unit_price_brl: string;
  delivery_label: string | null;
  is_active: boolean;
}


export interface AdminClient {
  id: number;
  nome: string;
  full_name: string;
  oab: string;
  oab_number: string | null;
  oab_uf: string | null;
  email: string;
  telefone: string;
  telefone_formatado: string;
  phone: string | null;
  cpf: string | null;
  cpf_formatado: string;
  role_title: string | null;
  employee_code: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  active_plan_id: number | null;
  plano: string;
  cadastrado_em: string;
  cadastrado_em_iso: string | null;
  ativo: boolean;
}

export interface AdminFinancialEntry {
  id: number;
  description: string;
  kind: "credit" | "debit";
  amount_cents: number;
  amount_brl: string;
  occurred_at: string;
  occurred_at_label: string;
  order_id: number | null;
  is_active: boolean;
}

export interface AdminFinancialSummary {
  stats: {
    receita_mes: number;
    receita_mes_brl: string;
    concluidos: number;
    abertos: number;
  };
  orders: AdminOrder[];
  entries: AdminFinancialEntry[];
}

export interface AdminCreditPurchase {
  id: number;
  code: string;
  user_email: string | null;
  user_name: string | null;
  package_name: string;
  amount_cents: number;
  amount_brl: string;
  status: string;
  pagarme_charge_id: string | null;
  pagarme_order_id: string | null;
  credited_at: string | null;
  created_at: string;
  source_kind?: "credit_purchase" | "checkout_order";
}

export interface AdminCheckoutOrderDetail extends AdminCreditPurchase {
  released_at: string | null;
  has_release_tx: boolean;
  needs_release: boolean;
}

export interface AdminNotification {
  id: string;
  source: "pagarme" | "resend" | string;
  kind: "payment" | "email" | string;
  severity: "success" | "warning" | "danger" | "info" | string;
  title: string;
  description: string;
  created_at: string;
  event_type: string;
  metadata: Record<string, unknown>;
}

export interface AdminNotificationChannels {
  pagarme_webhook_configured: boolean;
  resend_webhook_configured: boolean;
  notification_email_configured: boolean;
}

export interface AdminStaffMember {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  oab: string | null;
  cpf: string | null;
  role_title: string | null;
  employee_code: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  pedidos_ativos: number;
  pedidos_concluidos: number;
  ativo: boolean;
}

export interface CatalogItem {
  code: string;
  title: string;
  description: string | null;
  unit_price: number;
  delivery_label?: string | null;
}

export interface CatalogSection {
  section: string;
  items: CatalogItem[];
}

function getToken(): string | null {
  return sessionStorage.getItem("auth_token") || localStorage.getItem("auth_token");
}

import {
  CheckoutApiError,
  STATUS_LABEL,
  STATUS_TONE,
  checkoutApi,
  fetchCheckoutConfig,
  formatAmountFromCents,
  isTerminalStatus,
  tokenizeCard,
  type CheckoutPaymentMethod,
  type PaymentNextAction,
} from "@/lib/checkoutApi";
import type { CheckoutOrder as CheckoutOrderType } from "@/lib/checkoutApi";

export type { CheckoutOrderType };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const raw = await res.text();
  const data = raw ? (JSON.parse(raw) as unknown) : null;
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
        : "Erro inesperado.";
    throw new ApiError(message, res.status);
  }
  return data as T;
}

async function downloadDocumentFile(file: UploadedDocument): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(file.download_url, { headers });
  if (!res.ok) {
    let message = "Não foi possível baixar o documento.";
    try {
      const data = await res.json();
      if (data && typeof data === "object") {
        if ("message" in data && typeof data.message === "string") message = data.message;
        if ("error" in data && typeof data.error === "string") message = data.error;
      }
    } catch {
      // Download endpoints may return HTML/text for infrastructure errors.
    }
    throw new ApiError(message, res.status);
  }

  const contentType = res.headers.get("Content-Type")?.toLowerCase() ?? "";
  const contentDisposition = res.headers.get("Content-Disposition")?.toLowerCase() ?? "";
  const isAttachment = contentDisposition.includes("attachment");

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "O servidor retornou um erro no lugar do arquivo.";
    throw new ApiError(message, res.status);
  }

  if (contentType.includes("text/html") && !isAttachment) {
    throw new ApiError(
      "O servidor retornou uma página HTML no lugar do arquivo. Verifique a sessão e o proxy da API.",
      res.status,
    );
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.file_name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ContactPayload {
  name: string;
  whatsapp: string;
  email: string;
  message: string;
}

export const api = {
  public: {
    sendContact: (payload: ContactPayload) =>
      request<{ message: string }>("/contact", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  auth: {
    login: (email: string, password: string, remember = true) =>
      request<{ token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, remember }),
      }),
    register: (payload: RegisterPayload) =>
      request<{ token: string; user: AuthUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    requestPasswordReset: (email: string) =>
      request<{ message?: string }>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    confirmPasswordReset: (token: string, password: string) =>
      request<{ message?: string }>("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
  },

  me: {
    get: () => request<AuthUser>("/me"),
    update: (data: Partial<Pick<AuthUser, "full_name" | "oab_number" | "email" | "phone">>) =>
      request<AuthUser>("/me", { method: "PUT", body: JSON.stringify(data) }),
    balance: () => request<BalanceData>("/me/balance"),
    documents: () => request<{ documents: UploadedDocument[] }>("/me/documents"),
    changePassword: (payload: { current_password: string; new_password: string }) =>
      request<{ ok: boolean }>("/me/password", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    terms: {
      get: () => request<TermsAcceptanceResponse>("/me/terms"),
      accept: () => request<TermsAcceptanceResponse>("/me/terms", { method: "POST" }),
    },
  },

  dashboard: {
    get: (status?: string) =>
      request<DashboardData>(`/dashboard${status ? `?status=${status}` : ""}`),
  },

  petitions: {
    list: () => request<{ petitions: Petition[] }>("/petitions"),
    create: (payload: PetitionPayload) =>
      request<{ message: string; petition: Petition; order?: { id: number }; express_checkout_order_id?: string }>("/petitions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  documents: {
    upload: (files: File[]) => {
      const form = new FormData();
      files.forEach((file) => form.append("documents", file));
      return request<{ message: string; documents: UploadedDocument[] }>("/client-area/documents", {
        method: "POST",
        body: form,
      });
    },
    download: downloadDocumentFile,
  },

  content: {
    plans: () => request<{ plans: PublicPlan[] }>("/plans"),
    catalog: () => request<FullCatalog>("/catalog"),
    catalogItem: (code: string) =>
      request<CatalogItemLookup>(`/catalog/${encodeURIComponent(code)}`),
  },

  clientArea: {
    catalog: () => request<{ catalog: CatalogSection[] }>("/client-area"),
    orders: () => request<{ orders: ClientOrder[] }>("/client-area/orders"),
    checkoutOrders: () => request<{ orders: CheckoutOrderType[] }>("/client-area/checkout-orders"),
    getCheckoutOrder: (id: number | string) =>
      request<{ order: CheckoutOrderType }>(`/client-area/checkout-orders/${id}`),
    updateCheckoutOrder: (id: number | string, data: { service_id?: string }) =>
      request<{ order: CheckoutOrderType }>(`/client-area/checkout-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    cancelCheckoutOrder: (id: number | string) =>
      request<{ deleted: boolean; order: CheckoutOrderType }>(
        `/client-area/checkout-orders/${id}`,
        { method: "DELETE" },
      ),
    getOrder: (id: number) =>
      request<{ order: ClientOrder }>(`/client-area/orders/${id}`),
    createOrder: (data: {
      items?: { code: string; quantity: number }[];
      tipo_peticao?: string;
      area_direito?: string;
      service_code?: string;
      service_title?: string;
      petition_id?: number | null;
      deadline_at?: string | null;
    }) =>
      request<{ message: string; order: ClientOrder }>("/client-area/orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateOrder: (id: number, data: {
      deadline_at?: string;
      area_direito?: string;
      tipo_peticao?: string;
      numero_processo?: string;
      data_publicacao?: string;
      competencia?: string;
      comarca_uf?: string;
      advogado_subscritor?: string;
      resumo_caso?: string;
      detalhes?: string;
      justica_gratuita?: boolean;
      tutela_urgencia?: boolean;
      partes?: PetitionParty[];
    }) => request<{ order: ClientOrder }>(`/client-area/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    cancelOrder: (id: number) =>
      request<{ deleted: boolean; order: ClientOrder }>(
        `/client-area/orders/${id}`,
        { method: "DELETE" },
      ),
    uploadOrderDocuments: (orderId: number, files: File[]) => {
      const form = new FormData();
      files.forEach((file) => form.append("documents", file));
      return request<{ message: string; documents: UploadedDocument[]; order: ClientOrder }>(
        `/client-area/orders/${orderId}/documents`,
        { method: "POST", body: form },
      );
    },
    deleteDocument: (documentId: number) =>
      request<{ deleted: boolean }>(`/client-area/documents/${documentId}`, {
        method: "DELETE",
      }),
    listComments: (orderId: number) =>
      request<{ comments: OrderComment[] }>(`/orders/${orderId}/comments`),
    addComment: (orderId: number, text: string) =>
      request<{ comment: OrderComment }>(`/orders/${orderId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    deleteComment: (orderId: number, commentId: number) =>
      request<{ deleted: boolean }>(`/orders/${orderId}/comments/${commentId}`, {
        method: "DELETE",
      }),
  },

  staff: {
    profile: {
      get: () => request<AuthUser>("/staff/profile"),
      update: (data: Partial<{
        full_name: string | null;
        email: string | null;
        phone: string | null;
        zip_code: string | null;
        street: string | null;
        street_number: string | null;
        address_complement: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
      }>) =>
        request<AuthUser>("/staff/profile", {
          method: "PUT",
          body: JSON.stringify(data),
        }),
    },
    orders: {
      list: () => request<{ orders: StaffOrder[] }>("/staff/orders"),
      updateStatus: (id: number, status: StaffOrderStatus) => {
        if (!isStaffOrderStatus(status)) {
          throw new ApiError("Status de pedido inválido.", 400);
        }

        return request<{ order: StaffOrder }>(`/staff/orders/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
      },
    },
    financial: () => request<{ orders: StaffOrder[] }>("/staff/financial"),
  },

  admin: {
    notifications: () =>
      request<{
        notifications: AdminNotification[];
        channels: AdminNotificationChannels;
      }>("/admin/notifications"),
    profile: {
      get: () => request<AuthUser>("/admin/profile"),
      update: (data: Partial<{
        phone: string | null;
        email: string | null;
        zip_code: string | null;
        street: string | null;
        street_number: string | null;
        address_complement: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
      }>) =>
        request<AuthUser>("/admin/profile", {
          method: "PUT",
          body: JSON.stringify(data),
        }),
    },
    clients: {
      list: () => request<{ clients: AdminClient[] }>("/admin/clients"),
      get: (id: number) =>
        request<{ client: AdminClient }>(`/admin/clients/${id}`),
      create: (payload: {
        full_name: string;
        email: string;
        password: string;
        oab_number?: string | null;
        cpf?: string | null;
        phone?: string | null;
        active_plan_id?: number | null;
      }) =>
        request<{ client: AdminClient }>("/admin/clients", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      update: (
        id: number,
        payload: Partial<{
          full_name: string;
          email: string;
          oab_number: string | null;
          cpf: string | null;
          phone: string | null;
          role_title: string | null;
          employee_code: string | null;
          zip_code: string | null;
          street: string | null;
          street_number: string | null;
          address_complement: string | null;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          active_plan_id: number | null;
          is_active: boolean;
        }>,
      ) =>
        request<{ client: AdminClient }>(`/admin/clients/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
      delete: (id: number) =>
        request<null>(`/admin/clients/${id}`, { method: "DELETE" }),
    },
    staff: {
      list: () => request<{ staff: AdminStaffMember[] }>("/admin/staff"),
      create: (payload: {
        full_name: string;
        email: string;
        phone?: string | null;
        password: string;
      }) =>
        request<{ staff_member: AdminStaffMember }>("/admin/staff", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      update: (
        id: number,
        payload: Partial<{
          full_name: string;
          email: string;
          oab_number: string | null;
          cpf: string | null;
          phone: string | null;
          role_title: string | null;
          employee_code: string | null;
          zip_code: string | null;
          street: string | null;
          street_number: string | null;
          address_complement: string | null;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          is_active: boolean;
        }>,
      ) =>
        request<{ staff_member: AdminStaffMember }>(`/admin/staff/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
      delete: (id: number) =>
        request<null>(`/admin/staff/${id}`, { method: "DELETE" }),
    },
    orders: {
      list: () => request<{ orders: AdminOrder[] }>("/admin/orders"),
      get: (id: number) =>
        request<{ order: AdminOrder }>(`/admin/orders/${id}`),
      create: (payload: {
        user_id: number;
        tipo_servico: string;
        valor: number;
        status?: AdminOrderStatus;
        numero?: string;
        staff_user_id?: number | null;
        split_plataforma?: number;
        split_funcionario?: number;
        prazo_cliente?: string | null;
        finalizado_em?: string | null;
      }) =>
        request<{ order: AdminOrder }>("/admin/orders", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      delete: (id: number) =>
        request<null>(`/admin/orders/${id}`, { method: "DELETE" }),
      update: (
        id: number,
        payload: {
          status?: AdminOrderStatus;
          numero?: string;
          user_id?: number | null;
          tipo_servico?: string;
          valor?: number;
          split_plataforma?: number;
          split_funcionario?: number;
          staff_user_id?: number | null;
          deadline_at?: string | null;
          finalizado_em?: string | null;
          petition?: Partial<{
            area_direito: string;
            tipo_peticao: string | null;
            numero_processo: string | null;
            data_publicacao: string | null;
            justica_gratuita: boolean;
            tutela_urgencia: boolean;
            advogado_subscritor: string | null;
            resumo_caso: string | null;
            detalhes: string | null;
            partes: PetitionParty[];
          }>;
        },
      ) =>
        request<{ order: AdminOrder }>(`/admin/orders/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
      updateStatus: (id: number, status: AdminOrderStatus) => {
        if (!isAdminOrderStatus(status)) {
          throw new ApiError("Status de pedido inválido.", 400);
        }

        return request<{ order: AdminOrder }>(`/admin/orders/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
      },
      uploadDocuments: (id: number, files: File[]) => {
        const form = new FormData();
        files.forEach((f) => form.append("documents", f));
        return request<{ documents: UploadedDocument[] }>(`/orders/${id}/documents`, {
          method: "POST",
          body: form,
        });
      },
      listComments: (id: number) =>
        request<{ comments: OrderComment[] }>(`/orders/${id}/comments`),
      addComment: (id: number, text: string) =>
        request<{ comment: OrderComment }>(`/orders/${id}/comments`, {
          method: "POST",
          body: JSON.stringify({ text }),
        }),
      deleteComment: (orderId: number, commentId: number) =>
        request<{ deleted: boolean }>(`/orders/${orderId}/comments/${commentId}`, {
          method: "DELETE",
        }),
    },
    pricing: {
      list: () =>
        request<{ plans: AdminPlan[]; single_services: AdminServiceCatalogItem[] }>(
          "/admin/plans",
        ),
      createPlan: (
        payload: Pick<
          AdminPlan,
          "code" | "name" | "monthly_price_cents" | "monthly_credits_cents"
        > &
          Partial<
            Pick<
              AdminPlan,
              "description" | "petition_limit_monthly" | "price_per_service_cents" | "features" | "is_active"
            >
          >,
      ) =>
        request<{ plan: AdminPlan }>("/admin/plans", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      updatePlan: (
        id: number,
        payload: Partial<
          Pick<
            AdminPlan,
            "code" | "name" | "description" | "subtitle" | "monthly_price_cents" | "monthly_credits_cents" | "petition_limit_monthly" | "price_per_service_cents" | "features" | "benefits" | "is_active" | "is_highlighted" | "cta_label" | "delivery_label" | "badge" | "sort_order" | "credits_quantity" | "validity_days"
          >
        >,
      ) =>
        request<{ plan: AdminPlan }>(`/admin/plans/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
      deletePlan: (id: number) =>
        request<null>(`/admin/plans/${id}`, { method: "DELETE" }),
      listServices: () =>
        request<{ services: AdminServiceCatalogItem[] }>("/admin/services"),
      getService: (id: number) =>
        request<{ service: AdminServiceCatalogItem }>(`/admin/services/${id}`),
      createService: (
        payload: Pick<AdminServiceCatalogItem, "code" | "section" | "title" | "unit_price"> &
          Partial<Pick<AdminServiceCatalogItem, "description" | "is_active">>,
      ) =>
        request<{ service: AdminServiceCatalogItem }>("/admin/services", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      updateService: (
        id: number,
        payload: Partial<
          Pick<AdminServiceCatalogItem, "code" | "section" | "title" | "description" | "unit_price" | "delivery_label" | "is_active">
        >,
      ) =>
        request<{ service: AdminServiceCatalogItem }>(`/admin/services/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
      deleteService: (id: number) =>
        request<null>(`/admin/services/${id}`, { method: "DELETE" }),
    },
    financial: {
      summary: () => request<AdminFinancialSummary>("/admin/financial"),
      entries: () =>
        request<{ entries: AdminFinancialEntry[] }>("/admin/financial/entries"),
      creditPurchases: () =>
        request<{ purchases: AdminCreditPurchase[] }>("/admin/credit-purchases"),
      refundPurchase: (id: number) =>
        request<{ message?: string; purchase?: AdminCreditPurchase }>(
          `/admin/credit-purchases/${id}/refund`,
          { method: "POST" },
        ),
      refundCheckoutOrder: (id: number) =>
        request<{ message?: string; purchase?: AdminCreditPurchase }>(
          `/admin/checkout-orders/${id}/refund`,
          { method: "POST" },
        ),
      checkoutOrders: () =>
        request<{ orders: AdminCheckoutOrderDetail[] }>("/admin/checkout-orders"),
      releaseCheckoutOrderCredits: (id: number) =>
        request<{ released: boolean; already_done: boolean; message: string }>(
          `/admin/checkout-orders/${id}/release`,
          { method: "POST" },
        ),
      recoverAllPendingCredits: () =>
        request<{ recovered: number; skipped: number; order_ids: number[]; message: string }>(
          "/admin/checkout-orders/recover-all",
          { method: "POST" },
        ),
    },
  },
};
