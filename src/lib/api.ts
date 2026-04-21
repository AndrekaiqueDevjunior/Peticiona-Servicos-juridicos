export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  oab_number: string | null;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  oab_number: string;
  password: string;
  confirm_password: string;
}

export interface BalanceData {
  credits_available: number;
  credits_total: number;
  credits_used: number;
  movements: {
    type: "in" | "out";
    amount: number;
    description: string;
    date: string;
  }[];
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
  if (!res.ok) throw new Error((data as { error?: string }).error || "Erro inesperado.");
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
