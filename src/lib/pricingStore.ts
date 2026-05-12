// Store de preços editáveis pelo admin. Mock local (localStorage) — substituir
// por backend (/admin/pricing) quando disponível. Centraliza os valores usados
// em toda a plataforma (landing, checkout, novo pedido, admin).

import { useSyncExternalStore } from "react";

export interface PricingTable {
  planoEssencial: number;
  planoProfissional: number;
  planoEstrategico: number;
  avulsoGrupoA: number; // Petição Avulsa
  avulsoGrupoB: number; // Recurso Avulso
  peticaoExpress: number;
  recursoExpress: number;
}

export const DEFAULT_PRICING: PricingTable = {
  planoEssencial: 160,
  planoProfissional: 150,
  planoEstrategico: 140,
  avulsoGrupoA: 180,
  avulsoGrupoB: 200,
  peticaoExpress: 220,
  recursoExpress: 250,
};

const KEY = "peticiona:pricing-table:v1";

const load = (): PricingTable => {
  if (typeof window === "undefined") return DEFAULT_PRICING;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PRICING;
    const parsed = JSON.parse(raw) as Partial<PricingTable>;
    return { ...DEFAULT_PRICING, ...parsed };
  } catch {
    return DEFAULT_PRICING;
  }
};

let state: PricingTable = load();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => state;

export const useStoredPricing = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export const getPricing = () => state;

export const setPricing = (next: PricingTable) => {
  state = { ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
  notify();
};
