// Persistência local do status (ativo/bloqueado) dos funcionários.
// Substituir por mutação no backend quando disponível.
import { useSyncExternalStore } from "react";
import { ADMIN_FUNCIONARIOS } from "./adminMocks";

const STORAGE_KEY = "peticiona:staff:status:v1";

type StatusMap = Record<string, boolean>; // id -> ativo

const loadDefaults = (): StatusMap => {
  const map: StatusMap = {};
  ADMIN_FUNCIONARIOS.forEach((f) => {
    map[f.id] = f.ativo;
  });
  return map;
};

const load = (): StatusMap => {
  if (typeof window === "undefined") return loadDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return loadDefaults();
    const parsed = JSON.parse(raw) as StatusMap;
    return { ...loadDefaults(), ...parsed };
  } catch {
    return loadDefaults();
  }
};

let state: StatusMap = load();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
};

export const isStaffActive = (id: string): boolean => state[id] ?? true;

export const toggleStaffActive = (id: string): boolean => {
  const next = !(state[id] ?? true);
  state = { ...state, [id]: next };
  persist();
  // Log simples de auditoria (mock).
  try {
    const logKey = "peticiona:audit:v1";
    const log = JSON.parse(localStorage.getItem(logKey) ?? "[]");
    log.push({
      acao: next ? "desbloquear_funcionario" : "bloquear_funcionario",
      funcionarioId: id,
      em: new Date().toISOString(),
    });
    localStorage.setItem(logKey, JSON.stringify(log));
  } catch {
    /* noop */
  }
  notify();
  return next;
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useStaffStatus = (id: string): boolean =>
  useSyncExternalStore(
    subscribe,
    () => state[id] ?? true,
    () => state[id] ?? true,
  );
