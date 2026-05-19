// Saldo do cliente — consumido SEMPRE do backend (/api/me/balance).
//
// Antes este arquivo era um mock localStorage com "carteiras" separadas
// (peticao_avulsa, recurso_avulso, peticao_express, recurso_express e
// fila FIFO de planos). Isso permitia ao usuário abrir DevTools e
// fabricar saldo — embora o backend ainda barrasse a criação efetiva do
// pedido em _assert_sufficient_balance, a UI mostrava valores fakes e a
// regra de "qual carteira debitar" estava duplicada no cliente.
//
// O backend atual NÃO separa o saldo por categoria; ele opera sobre um
// único livro-razão (tabela credit_transactions, soma in - out). Quem
// decide se um pedido pode ser criado é sempre o backend. Aqui apenas
// LEMOS o agregado para exibição na UI.

import { useQuery } from "@tanstack/react-query";

import { api, type BalanceData, type BalanceMovement } from "@/lib/api";

export type MovementType = "in" | "out";

export type WalletKind = "agregado";

export const WALLET_LABEL: Record<WalletKind, string> = {
  agregado: "saldo disponível",
};

export interface Movement {
  id: string;
  type: MovementType;
  amount: number; // em centavos
  description: string;
  date: string; // ISO
  wallet: WalletKind;
}

export interface BalanceSnapshot {
  /** Saldo total em centavos (in - out, calculado pelo backend). */
  saldoCents: number;
  /** Saldo total formatado pelo backend. */
  saldoBRL: string;
  /** Total creditado (in) em centavos. */
  totalCreditadoCents: number;
  /** Total debitado (out) em centavos. */
  totalDebitadoCents: number;
  /** Movimentações vindas do backend (ordem decrescente por data). */
  movements: Movement[];
  isLoading: boolean;
  isError: boolean;
}

const EMPTY: BalanceSnapshot = {
  saldoCents: 0,
  saldoBRL: "R$ 0,00",
  totalCreditadoCents: 0,
  totalDebitadoCents: 0,
  movements: [],
  isLoading: true,
  isError: false,
};

const toMovement = (m: BalanceMovement, index: number): Movement => ({
  id: `${m.date}-${index}`,
  type: m.type,
  amount: m.amount_cents,
  description: m.description,
  date: m.date,
  wallet: "agregado",
});

const fromBackend = (data: BalanceData | undefined, isLoading: boolean, isError: boolean): BalanceSnapshot => {
  if (!data) return { ...EMPTY, isLoading, isError };
  return {
    saldoCents: data.credits_available_cents,
    saldoBRL: data.credits_available_brl,
    totalCreditadoCents: data.credits_total_cents,
    totalDebitadoCents: data.credits_used_cents,
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

/** Cobre o valor com o saldo disponível? Só serve para gating de UI;
 *  a decisão final é sempre do backend ao criar o pedido. */
export const cobreValor = (snapshot: BalanceSnapshot, valorCents: number) =>
  snapshot.saldoCents >= valorCents;
