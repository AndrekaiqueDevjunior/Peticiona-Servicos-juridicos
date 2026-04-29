import { z } from "zod";

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
const oabDigitsRegex = /^\d{1,10}$/;
const phoneRegex = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

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
