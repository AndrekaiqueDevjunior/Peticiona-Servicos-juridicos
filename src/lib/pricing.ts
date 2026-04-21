// Lógica de precificação do fluxo de novo pedido.
// Em produção, `useUserPricingProfile` deve consultar o backend (plano ativo,
// compras de Petição/Recurso Express). Hoje retornamos um mock — basta
// substituir o hook quando o backend existir.

import { useQuery } from "@tanstack/react-query";

export type PlanoAtivo = "essencial" | "profissional" | "estrategico" | null;

export interface UserPricingProfile {
  plano: PlanoAtivo;
  peticaoExpressDisponivel: boolean;
  recursoExpressDisponivel: boolean;
}

// ---- Tabelas ---------------------------------------------------------------

export const PRECO_PLANO: Record<Exclude<PlanoAtivo, null>, number> = {
  essencial: 180,
  profissional: 160,
  estrategico: 150,
};

export const LABEL_PLANO: Record<Exclude<PlanoAtivo, null>, string> = {
  essencial: "Plano Essencial",
  profissional: "Plano Profissional",
  estrategico: "Plano Estratégico",
};

export const PRECO_AVULSO_GRUPO_A = 180;
export const PRECO_AVULSO_GRUPO_B = 200;
export const PRECO_PETICAO_EXPRESS = 230;
export const PRECO_RECURSO_EXPRESS = 260;

// Grupo A — Petição Avulsa padrão / Petição Express
const GRUPO_A = new Set<string>([
  // Defesas
  "Contestação",
  "Embargos à execução",
  "Impugnação ao cumprimento de sentença",
  // Manifestações Gerais
  "Contrarrazões",
  "Petição intermediária",
  "Manifestação",
  "Alegações finais",
  "Razões finais",
  // Administrativo / Extrajudicial
  "Notificação extrajudicial",
  "Defesa administrativa",
  "Recurso administrativo",
  "Requerimentos administrativos",
]);

// Grupo B — Recurso Avulso padrão / Recurso Express
const GRUPO_B = new Set<string>([
  // Petições Iniciais
  "Petição inicial comum",
  "Mandado de segurança",
  "Cumprimento de sentença (inicial)",
  // Recursos
  "Apelação",
  "Agravo de instrumento",
  "Agravo interno",
  "Embargos de declaração",
  "Recurso ordinário",
  "Recurso especial",
  "Recurso extraordinário",
  "Agravo em recurso especial",
  "Agravo em recurso extraordinário",
]);

export type GrupoServico = "A" | "B" | null;

export const getGrupoServico = (tipoPeticao: string): GrupoServico => {
  if (!tipoPeticao) return null;
  if (GRUPO_A.has(tipoPeticao)) return "A";
  if (GRUPO_B.has(tipoPeticao)) return "B";
  return null;
};

// ---- Cálculo ---------------------------------------------------------------

export type Modalidade = "express" | "padrao";

export interface PricingResult {
  /** Preço do serviço padrão (plano ou avulso) — null se tipo não reconhecido */
  precoPadrao: number | null;
  /** Rótulo da modalidade padrão (ex: "Plano Profissional", "Petição Avulsa") */
  labelPadrao: string;
  /** Preço Express se aplicável e disponível para o usuário */
  precoExpress: number | null;
  /** Rótulo da modalidade express (ex: "Petição Express") */
  labelExpress: string | null;
  /** Modalidade efetivamente escolhida pelo usuário */
  modalidadeEscolhida: Modalidade;
  /** Preço final aplicado ao pedido */
  precoFinal: number;
  /** Rótulo da modalidade final */
  labelFinal: string;
  /** Grupo do serviço (A ou B) */
  grupo: GrupoServico;
}

export const calcularPrecoPedido = (
  tipoPeticao: string,
  perfil: UserPricingProfile,
  modalidadeEscolhida: Modalidade = "padrao",
): PricingResult => {
  const grupo = getGrupoServico(tipoPeticao);

  // Padrão: plano ativo tem prioridade sobre avulso.
  let precoPadrao: number | null = null;
  let labelPadrao = "";

  if (grupo) {
    if (perfil.plano) {
      precoPadrao = PRECO_PLANO[perfil.plano];
      labelPadrao = LABEL_PLANO[perfil.plano];
    } else if (grupo === "A") {
      precoPadrao = PRECO_AVULSO_GRUPO_A;
      labelPadrao = "Petição Avulsa";
    } else {
      precoPadrao = PRECO_AVULSO_GRUPO_B;
      labelPadrao = "Recurso Avulso";
    }
  }

  // Express é sempre opcional e adicional, independente do plano.
  let precoExpress: number | null = null;
  let labelExpress: string | null = null;
  if (grupo === "A" && perfil.peticaoExpressDisponivel) {
    precoExpress = PRECO_PETICAO_EXPRESS;
    labelExpress = "Petição Express";
  } else if (grupo === "B" && perfil.recursoExpressDisponivel) {
    precoExpress = PRECO_RECURSO_EXPRESS;
    labelExpress = "Recurso Express";
  }

  const expressAtivo =
    modalidadeEscolhida === "express" && precoExpress !== null;

  return {
    precoPadrao,
    labelPadrao,
    precoExpress,
    labelExpress,
    modalidadeEscolhida: expressAtivo ? "express" : "padrao",
    precoFinal: expressAtivo ? (precoExpress as number) : (precoPadrao ?? 0),
    labelFinal: expressAtivo ? (labelExpress as string) : labelPadrao,
    grupo,
  };
};

// ---- Hook (mock) -----------------------------------------------------------
// Substituir o queryFn quando o backend expuser /me/pricing-profile.
export const useUserPricingProfile = () => {
  return useQuery<UserPricingProfile>({
    queryKey: ["user-pricing-profile"],
    queryFn: async () => ({
      plano: null,
      peticaoExpressDisponivel: false,
      recursoExpressDisponivel: false,
    }),
    staleTime: Infinity,
  });
};

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
