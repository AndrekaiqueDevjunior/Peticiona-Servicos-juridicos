// Store local (mock) do saldo do cliente em R$.
// Substituir pelo backend quando existir endpoint dedicado.
//
// Regras (ver area-cliente/saldos):
// - Cada saldo só pode ser usado para o seu próprio serviço.
// - Plano ativo cobre apenas serviços PADRÃO (Petição Avulsa / Recurso Avulso).
// - Petição Express e Recurso Express exigem saldo do tipo correspondente.
// - Saldos não se misturam entre tipos diferentes.
// - Múltiplos planos ativos: usar em ordem de aquisição (FIFO).
//   Esgotar o plano mais antigo antes de começar a debitar do próximo.
//   Cada plano mantém seu próprio custo por pedido.

import { useSyncExternalStore } from "react";
import type { PlanoAtivo, GrupoServico, Modalidade } from "@/lib/pricing";
import { LABEL_PLANO, PRECO_PLANO } from "@/lib/pricing";

export type MovementType = "in" | "out";

// Identifica de qual carteira o débito (ou crédito) saiu/entrou.
// "plano" é genérico — o nome real do plano fica em `walletDetail`.
export type WalletKind =
  | "plano"
  | "peticao_avulsa"
  | "recurso_avulso"
  | "peticao_express"
  | "recurso_express";

export const WALLET_LABEL: Record<WalletKind, string> = {
  plano: "saldo do plano",
  peticao_avulsa: "saldo de Petição Avulsa",
  recurso_avulso: "saldo de Recurso Avulso",
  peticao_express: "saldo de Petição Express",
  recurso_express: "saldo de Recurso Express",
};

export interface Movement {
  id: string;
  type: MovementType;
  amount: number; // em R$
  description: string;
  date: string; // ISO
  wallet: WalletKind;
  /** Quando wallet === "plano", indica qual plano foi usado (ex.: "essencial"). */
  planoTipo?: Exclude<PlanoAtivo, null>;
}

export interface PlanoCarteira {
  id: string;
  tipo: Exclude<PlanoAtivo, null>;
  saldo: number;
  /** ISO — usado para ordenar FIFO (mais antigo primeiro). */
  adquiridoEmISO: string;
}

export interface BalanceState {
  /** Fila FIFO de planos ativos, ordenada do mais antigo para o mais recente. */
  planos: PlanoCarteira[];
  saldoPeticaoAvulsa: number; // R$
  saldoRecursoAvulso: number; // R$
  saldoPeticaoExpress: number; // R$
  saldoRecursoExpress: number; // R$
  movements: Movement[];
}

const STORAGE_KEY = "peticiona:balance:v3";
const LEGACY_KEY_V2 = "peticiona:balance:v2";

const initialState: BalanceState = {
  planos: [],
  saldoPeticaoAvulsa: 0,
  saldoRecursoAvulso: 0,
  saldoPeticaoExpress: 0,
  saldoRecursoExpress: 0,
  movements: [],
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** Migra estado v2 (plano único) para v3 (fila de planos). */
const migrateV2 = (legacy: Record<string, unknown>): BalanceState => {
  const planos: PlanoCarteira[] = [];
  const planoAtivo = legacy.planoAtivo as PlanoAtivo;
  const saldoPlano = (legacy.saldoPlano as number) ?? 0;
  if (planoAtivo && saldoPlano > 0) {
    planos.push({
      id: newId(),
      tipo: planoAtivo,
      saldo: saldoPlano,
      adquiridoEmISO: new Date(0).toISOString(),
    });
  }
  return {
    planos,
    saldoPeticaoAvulsa: (legacy.saldoPeticaoAvulsa as number) ?? 0,
    saldoRecursoAvulso: (legacy.saldoRecursoAvulso as number) ?? 0,
    saldoPeticaoExpress: (legacy.saldoPeticaoExpress as number) ?? 0,
    saldoRecursoExpress: (legacy.saldoRecursoExpress as number) ?? 0,
    movements: (legacy.movements as Movement[]) ?? [],
  };
};

const load = (): BalanceState => {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
    // Migração transparente do v2.
    const legacy = localStorage.getItem(LEGACY_KEY_V2);
    if (legacy) {
      const migrated = migrateV2(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return initialState;
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

export const useBalance = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

// ---- Helpers ---------------------------------------------------------------

/** Retorna planos ordenados FIFO (mais antigo primeiro). */
export const planosOrdenados = (s: BalanceState): PlanoCarteira[] =>
  [...s.planos].sort((a, b) =>
    a.adquiridoEmISO.localeCompare(b.adquiridoEmISO),
  );

/** Plano "em uso": o mais antigo com saldo suficiente para cobrir um pedido próprio. */
export const planoEmUso = (s: BalanceState): PlanoCarteira | null => {
  const ordenados = planosOrdenados(s);
  for (const p of ordenados) {
    if (p.saldo >= PRECO_PLANO[p.tipo]) return p;
  }
  // Se nenhum cobre o próprio custo, retorna o mais antigo com saldo > 0 (para exibição).
  return ordenados.find((p) => p.saldo > 0) ?? null;
};

/** Soma do saldo de todos os planos ativos. */
export const saldoTotalPlanos = (s: BalanceState): number =>
  s.planos.reduce((acc, p) => acc + p.saldo, 0);

/** Saldo total agregado (apenas para exibição informativa). */
export const getSaldoTotal = (s: BalanceState) =>
  saldoTotalPlanos(s) +
  s.saldoPeticaoAvulsa +
  s.saldoRecursoAvulso +
  s.saldoPeticaoExpress +
  s.saldoRecursoExpress;

export const temPeticaoExpress = (s: BalanceState) => s.saldoPeticaoExpress > 0;
export const temRecursoExpress = (s: BalanceState) => s.saldoRecursoExpress > 0;

// ---- Ações -----------------------------------------------------------------

// Compras reais de plano e crédito avulso são processadas pelo backend
// (POST /api/checkout/*). O ajuste de saldo após confirmação de pagamento
// é refletido via reload do estado real (saldo retornado pela API), não
// por mutação local — por isso não há mais helpers de "assinar" ou
// "comprar avulso" aqui. Mantido apenas o consumo do estado e a função
// de débito ao criar pedidos (debitarPedido), que segue local-only até
// o backend expor o endpoint de débito em tempo real.

export type CreditoAvulsoTipo =
  | "peticao_avulsa"
  | "recurso_avulso"
  | "peticao_express"
  | "recurso_express";

export interface DebitoResultado {
  ok: boolean;
  motivo?: string;
  walletUsada?: WalletKind;
  /** Quando o débito foi do plano, identifica qual plano. */
  planoUsado?: Exclude<PlanoAtivo, null>;
}

export interface CarteiraResolvida {
  wallet: WalletKind;
  saldo: number;
  /** Apenas quando wallet === "plano". */
  plano?: PlanoCarteira;
}

/**
 * Determina qual carteira deve ser debitada para um determinado serviço.
 * - Padrão: usa o plano FIFO mais antigo com saldo suficiente; se nenhum, cai no avulso correspondente.
 * - Express: SOMENTE a carteira Express correspondente.
 */
export const resolverCarteira = (
  s: BalanceState,
  grupo: GrupoServico,
  modalidade: Modalidade,
  valor: number,
): CarteiraResolvida | null => {
  if (!grupo) return null;

  if (modalidade === "express") {
    if (grupo === "A")
      return { wallet: "peticao_express", saldo: s.saldoPeticaoExpress };
    return { wallet: "recurso_express", saldo: s.saldoRecursoExpress };
  }

  // Padrão: percorre planos em ordem FIFO procurando o primeiro com saldo suficiente.
  const ordenados = planosOrdenados(s);
  for (const p of ordenados) {
    if (p.saldo >= valor) {
      return { wallet: "plano", saldo: p.saldo, plano: p };
    }
  }

  // Sem plano disponível: cai no avulso correspondente ao grupo.
  if (grupo === "A")
    return { wallet: "peticao_avulsa", saldo: s.saldoPeticaoAvulsa };
  return { wallet: "recurso_avulso", saldo: s.saldoRecursoAvulso };
};

/**
 * Debita um pedido respeitando a separação por carteiras e a fila FIFO de planos.
 */
export const debitarPedido = (
  valor: number,
  descricao: string,
  grupo: GrupoServico,
  modalidade: Modalidade,
): DebitoResultado => {
  const carteira = resolverCarteira(state, grupo, modalidade, valor);
  if (!carteira) {
    return { ok: false, motivo: "Tipo de serviço não reconhecido." };
  }
  if (carteira.saldo < valor) {
    return {
      ok: false,
      motivo: `Saldo insuficiente em ${WALLET_LABEL[carteira.wallet]}.`,
      walletUsada: carteira.wallet,
    };
  }

  setState((s) => {
    const next = { ...s };
    let descLabel = WALLET_LABEL[carteira.wallet];
    let planoTipo: Exclude<PlanoAtivo, null> | undefined;

    if (carteira.wallet === "plano" && carteira.plano) {
      planoTipo = carteira.plano.tipo;
      descLabel = `saldo do ${LABEL_PLANO[carteira.plano.tipo]}`;
      next.planos = s.planos.map((p) =>
        p.id === carteira.plano!.id ? { ...p, saldo: p.saldo - valor } : p,
      );
    } else {
      switch (carteira.wallet) {
        case "peticao_avulsa":
          next.saldoPeticaoAvulsa = s.saldoPeticaoAvulsa - valor;
          break;
        case "recurso_avulso":
          next.saldoRecursoAvulso = s.saldoRecursoAvulso - valor;
          break;
        case "peticao_express":
          next.saldoPeticaoExpress = s.saldoPeticaoExpress - valor;
          break;
        case "recurso_express":
          next.saldoRecursoExpress = s.saldoRecursoExpress - valor;
          break;
      }
    }

    next.movements = [
      {
        id: newId(),
        type: "out",
        amount: valor,
        description: `${descricao} — debitado do ${descLabel}`,
        date: new Date().toISOString(),
        wallet: carteira.wallet,
        planoTipo,
      },
      ...s.movements,
    ];
    return next;
  });

  return {
    ok: true,
    walletUsada: carteira.wallet,
    planoUsado: carteira.plano?.tipo,
  };
};

// PLANOS_INFO / AVULSOS_INFO removidos: planos e serviços avulsos são
// carregados via API (api.content.plans / api.content.catalog) e expostos
// pelo hook usePricingCatalog em lib/pricing.ts.
