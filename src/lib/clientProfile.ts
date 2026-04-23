// Perfil local do cliente (mock).
// Captura no cadastro: nome, CPF e OAB (imutáveis pelo cliente).
// Editáveis pelo cliente: telefone/WhatsApp e e-mail.
// Substituir pelo backend quando /me suportar esses campos.

import { useSyncExternalStore } from "react";
import { z } from "zod";

export interface ClientProfile {
  fullName: string;
  cpf: string;
  oab: string;
  oabUf: string;
  phone: string;
  email: string;
}

const STORAGE_KEY = "peticiona:client-profile:v1";

const empty: ClientProfile = {
  fullName: "",
  cpf: "",
  oab: "",
  oabUf: "",
  phone: "",
  email: "",
};

const load = (): ClientProfile => {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
};

let state: ClientProfile = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
};

const setState = (next: ClientProfile) => {
  state = next;
  persist();
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => state;

export const useClientProfile = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Define dados imutáveis (chamado no cadastro). */
export const setProfileOnSignup = (data: ClientProfile) => {
  setState({ ...data });
};

/** Atualiza somente os campos editáveis pelo cliente. */
export const updateEditableProfile = (data: Pick<ClientProfile, "phone" | "email">) => {
  setState({ ...state, ...data });
};

// ---- Validação ------------------------------------------------------------

// CPF — apenas formato (11 dígitos com máscara opcional).
const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const oabDigitsRegex = /^\d{1,10}$/;
// Telefone BR — 10 ou 11 dígitos com máscara opcional.
const phoneRegex = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;

export const profileEditableSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, { message: "Telefone é obrigatório" })
    .regex(phoneRegex, { message: "Telefone inválido. Ex: (11) 91234-5678" })
    .max(20),
  email: z
    .string()
    .trim()
    .min(1, { message: "E-mail é obrigatório" })
    .email({ message: "E-mail inválido" })
    .max(255),
});

export const profileSignupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, { message: "Nome completo é obrigatório" })
    .max(120),
  cpf: z
    .string()
    .trim()
    .min(1, { message: "CPF é obrigatório" })
    .regex(cpfRegex, { message: "CPF inválido. Ex: 000.000.000-00" }),
  oab: z
    .string()
    .trim()
    .min(1, { message: "OAB é obrigatória" })
    .regex(oabDigitsRegex, { message: "OAB inválida. Informe apenas números." })
    .max(10),
  oabUf: z.enum(brazilianStates, { message: "Selecione a UF da OAB" }),
  phone: profileEditableSchema.shape.phone,
  email: profileEditableSchema.shape.email,
});

export const BRAZILIAN_UF_OPTIONS = [...brazilianStates];
