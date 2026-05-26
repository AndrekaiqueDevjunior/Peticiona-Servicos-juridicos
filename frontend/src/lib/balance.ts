// Saldo do cliente — consumido SEMPRE do backend (/api/me/balance).
//
// Sistema novo: 3 saldos segregados por kind (nunca se misturam):
// - common: créditos para serviços regulares (1 crédito = 1 serviço)
// - peticao_express: créditos pré-comprados para petições em 24h
// - recurso_express: créditos pré-comprados para recursos em 24h
//
// Legacy: kind='legacy_cents' marca saldos históricos em centavos (pré-migração),
// preservados para auditoria mas não contados nos saldos ativos.
//
// Quem decide se um pedido pode ser criado é sempre o backend (advisory lock + check).
// Aqui apenas LEMOS os 3 saldos para exibição na UI.

import { useQuery } from "@tanstack/react-query";

import { api, type BalanceData, type BalanceMovement } from "@/lib/api";

export type MovementType = "in" | "out";

export type CreditKind = "common" | "peticao_express" | "recurso_express";

export const CREDIT_KIND_LABEL: Record<CreditKind, string> = {
  common: "Créditos Comuns",
  peticao_express: "Créditos Petição Express",
  recurso_express: "Créditos Recurso Express",
};

export interface Movement {
  id: string;
  type: MovementType;
  amount: number; // em unidades de crédito
  kind: CreditKind | "legacy_cents"; // o kind da transação
  description: string;
  date: string; // ISO
  amountFormatted: string; // "X crédito(s)" ou "R$ X,XX" para legacy
}

export interface BalanceSnapshot {
  // Saldos segregados por kind (1 crédito = 1 unidade, nunca se misturam)
  balances: {
    common: number;
    peticao_express: number;
    recurso_express: number;
  };
  // Totais por kind (in, out, balance)
  totals: {
    common: { credits_in: number; credits_out: number };
    peticao_express: { credits_in: number; credits_out: number };
    recurso_express: { credits_in: number; credits_out: number };
  };
  // Legacy compat: saldo de créditos comuns
  saldoCents: number;
  saldoBRL: string;
  totalCreditadoCents: number;
  totalDebitadoCents: number;
  // Movimentações vindas do backend (ordem decrescente por data)
  movements: Movement[];
  isLoading: boolean;
  isError: boolean;
}

const EMPTY: BalanceSnapshot = {
  balances: { common: 0, peticao_express: 0, recurso_express: 0 },
  totals: {
    common: { credits_in: 0, credits_out: 0 },
    peticao_express: { credits_in: 0, credits_out: 0 },
    recurso_express: { credits_in: 0, credits_out: 0 },
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
  kind: m.kind,
  description: m.description,
  date: m.date,
  amountFormatted: m.amount_brl,
});

const fromBackend = (data: BalanceData | undefined, isLoading: boolean, isError: boolean): BalanceSnapshot => {
  if (!data)
    return { ...EMPTY, isLoading, isError };
  return {
    balances: data.balances,
    totals: {
      common: data.totals_by_kind.common,
      peticao_express: data.totals_by_kind.peticao_express,
      recurso_express: data.totals_by_kind.recurso_express,
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

/** Verifica se há crédito disponível de um kind específico.
 *  Apenas para gating de UI; a decisão final é sempre do backend. */
export const hasCredit = (snapshot: BalanceSnapshot, kind: CreditKind, amount: number = 1): boolean =>
  snapshot.balances[kind] >= amount;

/** Verifica se há crédito comum disponível (common kind). */
export const hasCommonCredit = (snapshot: BalanceSnapshot, amount: number = 1): boolean =>
  snapshot.balances.common >= amount;

/** Verifica se há crédito de Petição Express disponível. */
export const hasPetitionExpressCredit = (snapshot: BalanceSnapshot): boolean =>
  snapshot.balances.peticao_express >= 1;

/** Verifica se há crédito de Recurso Express disponível. */
export const hasResourceExpressCredit = (snapshot: BalanceSnapshot): boolean =>
  snapshot.balances.recurso_express >= 1;
