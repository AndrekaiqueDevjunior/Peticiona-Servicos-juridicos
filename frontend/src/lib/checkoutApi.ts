// Cliente HTTP do fluxo de checkout Pagar.me.
//
// IMPORTANTE: o frontend NUNCA define o valor do pagamento, NUNCA conhece a
// chave secreta do Pagar.me e NUNCA fala com o Pagar.me direto. Tudo passa
// pelo backend (a ser implementado pelo dev) através destes endpoints:
//
//   POST /api/checkout/create-order
//     body: { service_id: string }            // valor é resolvido no backend
//     200:  { order: CheckoutOrder }
//
//   POST /api/checkout/create-payment
//     body: { order_id: string, payment_method: "pix" | "credit_card" | "boleto",
//             card?: { ... tokenizado no front via SDK público do Pagar.me ... } }
//     200:  { order: CheckoutOrder, next_action?: { type: "pix"|"redirect"|"boleto",
//             qr_code?: string, qr_code_url?: string, url?: string,
//             boleto_url?: string, expires_at?: string } }
//
//   GET  /api/checkout/status/:orderId
//     200:  { order: CheckoutOrder }
//
//   POST /api/webhooks/pagarme   (consumido pelo backend, não pelo frontend)
//
// O backend é responsável por: validar usuário autenticado, validar serviço,
// calcular o valor real, garantir idempotência, validar assinatura do webhook
// do Pagar.me e liberar o crédito/serviço somente após `status === "paid"`.

export type CheckoutOrderStatus =
  | "pending"
  | "processing"
  | "waiting_payment"
  | "paid"
  | "failed"
  | "refused"
  | "canceled"
  | "expired"
  | "refunded"
  | "chargeback";

export type CheckoutPaymentMethod = "pix" | "credit_card" | "boleto";

/** O backend usa códigos dinâmicos do catálogo oficial para resolver o preço. */
export type CheckoutServiceId = string;

export interface CheckoutOrder {
  id: string;
  user_id: string | number;
  service_id: CheckoutServiceId;
  service_name?: string | null;
  /** Valor em centavos, calculado pelo backend. */
  amount: number;
  currency: "BRL";
  status: CheckoutOrderStatus;
  pagarme_order_id: string | null;
  pagarme_charge_id: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  /** ISO de quando o crédito foi liberado ao saldo do cliente. Preenchido
   *  pelo _release_order após o pagamento ser confirmado. */
  released_at: string | null;
  /** Dados da cobrança ativa (PIX/boleto) para restaurar após refresh.
   *  Não é devolvido pelo backend atual — o frontend deriva localmente
   *  quando refaz a cobrança. */
  active_payment?: ActivePayment | null;
}

export interface PaymentNextAction {
  type: "pix" | "redirect" | "boleto" | "none";
  qr_code?: string;
  qr_code_url?: string;
  url?: string;
  boleto_url?: string;
  expires_at?: string;
}

export interface ActivePayment {
  type: "pix" | "boleto";
  qr_code?: string;
  qr_code_url?: string;
  boleto_url?: string;
  line?: string;
  expires_at?: string;
  due_at?: string;
}

export interface CreatePaymentResponse {
  order: CheckoutOrder;
  next_action?: PaymentNextAction;
  failure_reason?: string;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

const getAuthHeader = (): Record<string, string> => {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

class CheckoutApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  const data = text ? safeParse(text) : null;
  if (!res.ok) {
    const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const message =
      (d && typeof d.message === "string" && d.message) ||
      (d && typeof d.error === "string" && d.error) ||
      `Erro ${res.status} ao chamar ${path}`;
    throw new CheckoutApiError(message, res.status);
  }
  return data as T;
};

const safeParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const checkoutApi = {
  createOrder: (
    service_id: CheckoutServiceId,
    expected_amount?: number,
    service_order_id?: number,
  ) =>
    request<{ order: CheckoutOrder }>("/checkout/create-order", {
      method: "POST",
      body: JSON.stringify({ service_id, expected_amount, service_order_id }),
    }),

  createPayment: (input: {
    order_id: string;
    payment_method: CheckoutPaymentMethod;
    buyer?: {
      fullName: string;
      email: string;
      cpf: string;
      phone: string;
    };
    card?: {
      token: string;
      installments: number;
    };
    billing_address?: {
      zip_code: string;
      street: string;
      street_number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      country?: string;
    };
  }) =>
    request<CreatePaymentResponse>("/checkout/create-payment", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getStatus: (orderId: string) =>
    request<{ order: CheckoutOrder }>(`/checkout/status/${encodeURIComponent(orderId)}`),

  refreshStatus: (orderId: string) =>
    request<{ order: CheckoutOrder }>(`/checkout/status/${encodeURIComponent(orderId)}`),
};

export { CheckoutApiError };

// ---------------------------------------------------------------------------
// Tokenização do cartão direto na Pagar.me (dados nunca passam pelo backend)
// ---------------------------------------------------------------------------

const PAGARME_API = "https://api.pagar.me/core/v5";

export const fetchCheckoutConfig = () =>
  request<{ public_key: string }>("/checkout/config");

export const tokenizeCard = async (
  publicKey: string,
  card: {
    number: string;
    holder_name: string;
    exp_month: number;
    exp_year: number;
    cvv: string;
  }
): Promise<string> => {
  const res = await fetch(
    `${PAGARME_API}/tokens?appId=${encodeURIComponent(publicKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "card",
        card: {
          number: card.number.replace(/\D/g, ""),
          holder_name: card.holder_name,
          exp_month: card.exp_month,
          exp_year: card.exp_year,
          cvv: card.cvv,
        },
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string =
      (data as Record<string, unknown>)?.message as string ||
      (data as Record<string, unknown>)?.error as string ||
      "Erro ao tokenizar cartão.";
    throw new CheckoutApiError(msg, res.status);
  }
  const token = (data as Record<string, unknown>)?.id as string | undefined;
  if (!token) throw new CheckoutApiError("Token inválido recebido do gateway.", 502);
  return token;
};

// ---------------------------------------------------------------------------
// Helpers de UI
// ---------------------------------------------------------------------------

export const STATUS_LABEL: Record<CheckoutOrderStatus, string> = {
  pending: "Aguardando pagamento",
  processing: "Processando pagamento",
  waiting_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  failed: "Pagamento recusado",
  refused: "Pagamento recusado",
  canceled: "Pedido cancelado",
  expired: "Pagamento expirado",
  refunded: "Pagamento estornado",
  chargeback: "Chargeback",
};

export const STATUS_TONE: Record<CheckoutOrderStatus, "neutral" | "warning" | "success" | "danger"> = {
  pending: "warning",
  processing: "warning",
  waiting_payment: "warning",
  paid: "success",
  failed: "danger",
  refused: "danger",
  canceled: "danger",
  expired: "danger",
  refunded: "neutral",
  chargeback: "danger",
};

export const isTerminalStatus = (s: CheckoutOrderStatus) =>
  s === "paid" || s === "failed" || s === "refused" || s === "canceled" || s === "expired" || s === "refunded" || s === "chargeback";

export const formatAmountFromCents = (amount: number) =>
  (amount / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
