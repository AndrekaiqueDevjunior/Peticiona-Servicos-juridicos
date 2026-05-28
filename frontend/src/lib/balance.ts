// Saldo do cliente — consumido SEMPRE do backend (/api/me/balance).
//
// Sistema atual: saldo único de créditos comuns (1 crédito = 1 serviço).
// Express é um upgrade pago no momento do pedido, sem saldo separado.
//
// Legacy: kind='legacy_cents' marca saldos históricos em centavos (pré-migração),
// preservados para auditoria mas não contados nos saldos ativos.
//
// Quem decide se um pedido pode ser criado é sempre o backend (advisory lock + check).

import { useQuery } from "@tanstack/react-query";

import { api, type BalanceData, type BalanceMovement } from "@/lib/api";

export type MovementType = "in" | "out";

export type CreditKind = "common";

export const CREDIT_KIND_LABEL: Record<CreditKind, string> = {
  common: "Créditos disponíveis",
};

export interface Movement {
  id: string;
  type: MovementType;
  amount: number;
  kind: CreditKind | "legacy_cents";
  description: string;
  date: string; // ISO
  amountFormatted: string;
}

export interface BalanceSnapshot {
  balances: {
    common: number;
  };
  totals: {
    common: { credits_in: number; credits_out: number };
  };
  // Legacy compat: saldo de créditos comuns
  saldoCents: number;
  saldoBRL: string;
  totalCreditadoCents: number;
  totalDebitadoCents: number;
  movements: Movement[];
  isLoading: boolean;
  isError: boolean;
}

const EMPTY: BalanceSnapshot = {
  balances: { common: 0 },
  totals: {
    common: { credits_in: 0, credits_out: 0 },
  },
  saldoCents: 0,
  saldoBRL: "0 crédito(s)",
  totalCreditadoCents: 0,
  totalDebitadoCents: 0,
  movements: [],
  isLoading: true,
  isError: false,
};

const toMovement = (m: BalanceMovement, index: number): Movement => ({
  id: `${m.date}-${index}`,
  type: m.type,
  amount: m.amount,
  kind: m.kind as CreditKind | "legacy_cents",
  description: m.description,
  date: m.date,
  amountFormatted: m.amount_brl,
});

const fromBackend = (data: BalanceData | undefined, isLoading: boolean, isError: boolean): BalanceSnapshot => {
  if (!data)
    return { ...EMPTY, isLoading, isError };
  return {
    balances: { common: data.balances.common ?? data.credits_available },
    totals: {
      common: data.totals_by_kind?.common ?? { credits_in: data.credits_total, credits_out: data.credits_used },
    },
    saldoCents: data.credits_available,
    saldoBRL: data.credits_available_brl,
    totalCreditadoCents: data.credits_total,
    totalDebitadoCents: data.credits_used,
    movements: data.movements.map(toMovement),
    isLoading,
    isError,
  };
};

/** Hook que devolve o saldo agregado do cliente vindo do backend. */
export const useBalance = (): BalanceSnapshot => {
  const query = useQuery({
    queryKey: ["me-balance"],
    queryFn: () => api.me.balance(),
    staleTime: 15_000,
  });
  return fromBackend(query.data, query.isLoading, query.isError);
};

// ---- Helpers de exibição --------------------------------------------------

/** Verifica se há crédito comum disponível. Apenas para gating de UI; a decisão final é sempre do backend. */
export const hasCommonCredit = (snapshot: BalanceSnapshot, amount: number = 1): boolean =>
  snapshot.balances.common >= amount;

/** Alias para hasCommonCredit — mantido para compatibilidade com chamadas existentes. */
export const hasCredit = (snapshot: BalanceSnapshot, _kind: string, amount: number = 1): boolean =>
  snapshot.balances.common >= amount;
