// Sistema de roles (mock via localStorage).
// Em produção: substituir por leitura de campo `role` do backend (user_roles table).

import { useSyncExternalStore } from "react";

export type UserRole = "cliente" | "funcionario" | "admin";

const STORAGE_KEY = "peticiona:role:v1";

const load = (): UserRole => {
  if (typeof window === "undefined") return "cliente";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "admin" || v === "funcionario" || v === "cliente") return v;
  return "cliente";
};

let role: UserRole = load();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export const setRole = (r: UserRole) => {
  role = r;
  try {
    localStorage.setItem(STORAGE_KEY, r);
  } catch {
    /* noop */
  }
  notify();
};

export const getRole = () => role;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useRole = (): UserRole =>
  useSyncExternalStore(subscribe, () => role, () => role);

export const dashboardPathForRole = (r: UserRole): string => {
  switch (r) {
    case "admin":
      return "/admin";
    case "funcionario":
      return "/area-interna";
    default:
      return "/area-cliente";
  }
};
