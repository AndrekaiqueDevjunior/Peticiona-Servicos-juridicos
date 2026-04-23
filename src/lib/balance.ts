// Store local (mock) do saldo do cliente em R$.
// Substituir pelo backend quando existir endpoint dedicado.
// Saldo é separado em duas "carteiras": plano e avulso. O débito sempre
// consome primeiro o saldo do plano ativo e, se faltar, complementa com avulso.

import { useSyncExternalStore } from "react";
import type { PlanoAtivo } from "@/lib/pricing";
import { LABEL_PLANO } from "@/lib/pricing";

export type MovementType = "in" | "out";

export interface Movement {
  id: string;
  type: MovementType;
  amount: number; // em R$
  description: string;
  date: string; // ISO
  source?: "plano" | "avulso" | "mix";
}

export interface BalanceState {
  planoAtivo: PlanoAtivo;
  saldoPlano: number; // R$
  saldoAvulso: number; // R$
  peticaoExpressDisponivel: boolean;
  recursoExpressDisponivel: boolean;
  movements: Movement[];
}

const STORAGE_KEY = "peticiona:balance:v1";

const initialState: BalanceState = {
  planoAtivo: null,
  saldoPlano: 0,
  saldoAvulso: 0,
  peticaoExpressDisponivel: false,
  recursoExpressDisponivel: false,
  movements: [],
};

const load = (): BalanceState => {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
};

let state: BalanceState = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
};

const setState = (updater: (s: BalanceState) => BalanceState) => {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => state;

export const useBalance = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

// ---- Helpers ---------------------------------------------------------------

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const getSaldoTotal = (s: BalanceState) => s.saldoPlano + s.saldoAvulso;

// ---- Ações -----------------------------------------------------------------

export const assinarPlano = (plano: Exclude<PlanoAtivo, null>) => {
  const valores: Record<Exclude<PlanoAtivo, null>, number> = {
    essencial: 540,
    profissional: 800,
    estrategico: 3000,
  };
  const valor = valores[plano];
  setState((s) => ({
    ...s,
    planoAtivo: plano,
    saldoPlano: s.saldoPlano + valor,
    movements: [
      {
        id: newId(),
        type: "in",
        amount: valor,
        description: `Assinatura — ${LABEL_PLANO[plano]}`,
        date: new Date().toISOString(),
        source: "plano",
      },
      ...s.movements,
    ],
  }));
};

export type CreditoAvulsoTipo =
  | "peticao_avulsa"
  | "recurso_avulso"
  | "peticao_express"
  | "recurso_express";

const AVULSO_LABEL: Record<CreditoAvulsoTipo, string> = {
  peticao_avulsa: "Petição Avulsa",
  recurso_avulso: "Recurso Avulso",
  peticao_express: "Petição Express",
  recurso_express: "Recurso Express",
};

const AVULSO_VALOR: Record<CreditoAvulsoTipo, number> = {
  peticao_avulsa: 180,
  recurso_avulso: 200,
  peticao_express: 230,
  recurso_express: 260,
};

export const comprarCreditoAvulso = (tipo: CreditoAvulsoTipo, qtd = 1) => {
  const valor = AVULSO_VALOR[tipo] * qtd;
  setState((s) => ({
    ...s,
    saldoAvulso: s.saldoAvulso + valor,
    peticaoExpressDisponivel:
      s.peticaoExpressDisponivel || tipo === "peticao_express",
    recursoExpressDisponivel:
      s.recursoExpressDisponivel || tipo === "recurso_express",
    movements: [
      {
        id: newId(),
        type: "in",
        amount: valor,
        description: `Compra — ${AVULSO_LABEL[tipo]}${qtd > 1 ? ` (x${qtd})` : ""}`,
        date: new Date().toISOString(),
        source: "avulso",
      },
      ...s.movements,
    ],
  }));
};

export interface DebitoResultado {
  ok: boolean;
  faltante?: number;
}

/**
 * Debita um pedido. Prioriza o saldo do plano ativo, depois avulso.
 */
export const debitarPedido = (
  valor: number,
  descricao: string,
): DebitoResultado => {
  const total = getSaldoTotal(state);
  if (total < valor) {
    return { ok: false, faltante: valor - total };
  }
  setState((s) => {
    const doPlano = Math.min(s.saldoPlano, valor);
    const doAvulso = valor - doPlano;
    const source: Movement["source"] =
      doPlano > 0 && doAvulso > 0 ? "mix" : doPlano > 0 ? "plano" : "avulso";
    return {
      ...s,
      saldoPlano: s.saldoPlano - doPlano,
      saldoAvulso: s.saldoAvulso - doAvulso,
      movements: [
        {
          id: newId(),
          type: "out",
          amount: valor,
          description: descricao,
          date: new Date().toISOString(),
          source,
        },
        ...s.movements,
      ],
    };
  });
  return { ok: true };
};

/** Reseta o store para o estado inicial. Uso exclusivo em testes. */
export const _resetForTest = () => {
  state = { ...initialState };
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
};

export const PLANOS_INFO = [
  {
    id: "essencial" as const,
    nome: "Plano Essencial",
    valor: 540,
    porPedido: 180,
    descricao: "Saldo mensal de R$ 540,00 — cada pedido debita R$ 180,00.",
  },
  {
    id: "profissional" as const,
    nome: "Plano Profissional",
    valor: 800,
    porPedido: 160,
    descricao: "Saldo mensal de R$ 800,00 — cada pedido debita R$ 160,00.",
  },
  {
    id: "estrategico" as const,
    nome: "Plano Estratégico",
    valor: 3000,
    porPedido: 150,
    descricao: "Saldo mensal de R$ 3.000,00 — cada pedido debita R$ 150,00.",
  },
];

export const AVULSOS_INFO: {
  id: CreditoAvulsoTipo;
  nome: string;
  valor: number;
  descricao: string;
}[] = [
  {
    id: "peticao_avulsa",
    nome: "Petição Avulsa",
    valor: 180,
    descricao: "Crédito para serviços do Grupo A (defesas, manifestações, administrativo).",
  },
  {
    id: "recurso_avulso",
    nome: "Recurso Avulso",
    valor: 200,
    descricao: "Crédito para serviços do Grupo B (iniciais e recursos).",
  },
  {
    id: "peticao_express",
    nome: "Petição Express",
    valor: 230,
    descricao: "Entrega prioritária para serviços do Grupo A.",
  },
  {
    id: "recurso_express",
    nome: "Recurso Express",
    valor: 260,
    descricao: "Entrega prioritária para serviços do Grupo B.",
  },
];
