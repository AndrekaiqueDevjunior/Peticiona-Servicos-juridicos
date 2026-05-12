// Perfil dos clientes (mock keyed-by-id).
//
// O mesmo store é compartilhado entre:
// - /area-cliente/conta (cliente edita o próprio perfil — telefone/e-mail)
// - /admin/clientes (admin pode editar TODOS os campos de qualquer cliente,
//   e a alteração reflete imediatamente no "Meu perfil" do cliente).
//
// Em produção, isso vira um endpoint /clients/:id no backend.

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

/**
 * Id do cliente "atual" (mock). Em produção viria do contexto de auth.
 * Coincide com o primeiro cliente em ADMIN_CLIENTES para que edições do
 * admin sobre esse id sejam visíveis no "Meu perfil" do cliente logado.
 */
export const CURRENT_CLIENT_ID = "c1";

const STORAGE_KEY = "peticiona:client-profiles:v2";
const LEGACY_KEY = "peticiona:client-profile:v1";

const empty: ClientProfile = {
  fullName: "",
  cpf: "",
  oab: "",
  oabUf: "",
  phone: "",
  email: "",
};

type ProfilesMap = Record<string, ClientProfile>;

const load = (): ProfilesMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ProfilesMap;

    // Migração do schema v1 (perfil único do cliente logado).
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const single = JSON.parse(legacy) as ClientProfile;
      const map: ProfilesMap = { [CURRENT_CLIENT_ID]: { ...empty, ...single } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      return map;
    }
    return {};
  } catch {
    return {};
  }
};

let state: ProfilesMap = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
};

const setState = (next: ProfilesMap) => {
  state = next;
  persist();
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => state;

const useProfilesMap = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Lê o perfil de um cliente específico. Sempre devolve um objeto preenchido. */
export const useClientProfileById = (id: string): ClientProfile => {
  const map = useProfilesMap();
  return map[id] ?? empty;
};

/** Hook usado pela área do cliente — lê o perfil do cliente logado. */
export const useClientProfile = (): ClientProfile =>
  useClientProfileById(CURRENT_CLIENT_ID);

/** Define dados imutáveis (chamado no cadastro do cliente atual). */
export const setProfileOnSignup = (data: ClientProfile) => {
  setState({ ...state, [CURRENT_CLIENT_ID]: { ...data } });
};

/** Atualiza somente os campos editáveis pelo cliente. */
export const updateEditableProfile = (
  data: Pick<ClientProfile, "phone" | "email">,
) => {
  const current = state[CURRENT_CLIENT_ID] ?? empty;
  setState({ ...state, [CURRENT_CLIENT_ID]: { ...current, ...data } });
};

/**
 * Atualiza o perfil completo de um cliente (uso administrativo).
 * Reflete imediatamente no "Meu perfil" do cliente correspondente.
 */
export const adminUpdateClientProfile = (id: string, data: ClientProfile) => {
  setState({ ...state, [id]: { ...data } });
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

/** Schema usado pelo admin — todos os campos podem ser editados. */
export const profileAdminSchema = profileSignupSchema;

export const BRAZILIAN_UF_OPTIONS = [...brazilianStates];
