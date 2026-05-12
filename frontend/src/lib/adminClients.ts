// Store reativo (mock) dos clientes vistos pelo admin.
// Mantém o status "suspenso" e expõe ações de admin (suspender / reativar).
// O perfil pessoal de cada cliente fica em src/lib/clientProfile.ts (compartilhado
// com a área do cliente, para que edições do admin reflitam no "Meu perfil").

import { useSyncExternalStore } from "react";
import { ADMIN_CLIENTES, type AdminClienteMock } from "@/lib/adminMocks";

export interface AdminClienteState extends AdminClienteMock {
  suspenso: boolean;
}

const STORAGE_KEY = "peticiona:admin-clients:v1";

const seed = (): AdminClienteState[] =>
  ADMIN_CLIENTES.map((c) => ({ ...c, suspenso: !c.ativo }));

const load = (): AdminClienteState[] => {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as AdminClienteState[];
    // Garante que clientes novos no mock apareçam mesmo após persistência.
    const map = new Map(parsed.map((c) => [c.id, c] as const));
    const merged = ADMIN_CLIENTES.map((c) => {
      const existing = map.get(c.id);
      return existing ? { ...c, ...existing } : { ...c, suspenso: !c.ativo };
    });
    return merged;
  } catch {
    return seed();
  }
};

let state: AdminClienteState[] = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
};

const setState = (updater: (s: AdminClienteState[]) => AdminClienteState[]) => {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => state;

export const useAdminClients = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Suspende ou reativa a conta do cliente. */
export const setClienteSuspenso = (id: string, suspenso: boolean) => {
  setState((list) =>
    list.map((c) => (c.id === id ? { ...c, suspenso, ativo: !suspenso } : c)),
  );
};

/** Atualiza dados básicos do cliente exibidos na tabela (e-mail, telefone, plano). */
export const adminUpdateClienteRow = (
  id: string,
  patch: Partial<Pick<AdminClienteState, "email" | "telefone" | "nome" | "oab" | "plano">>,
) => {
  setState((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
};
