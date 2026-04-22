// Aceite dos Termos de Uso (mock local; trocar por backend quando disponível).

import { useSyncExternalStore } from "react";

export const TERMS_VERSION = "1.0.0";

export interface TermsAcceptance {
  version: string;
  acceptedAt: string; // ISO
  ip: string | null;
}

const KEY = "peticiona:terms-acceptance:v1";

const load = (): TermsAcceptance | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TermsAcceptance;
  } catch {
    return null;
  }
};

let state: TermsAcceptance | null = load();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => state;

export const useTermsAcceptance = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

const fetchIP = async (): Promise<string | null> => {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? null;
  } catch {
    return null;
  }
};

export const acceptTerms = async () => {
  const ip = await fetchIP();
  const next: TermsAcceptance = {
    version: TERMS_VERSION,
    acceptedAt: new Date().toISOString(),
    ip,
  };
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  notify();
};

export const hasAcceptedCurrentTerms = () =>
  state?.version === TERMS_VERSION;
