import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type CatalogSection, type PublicPlan } from "./api";

export type PlanoAtivo = "essencial" | "profissional" | "estrategico" | null;

export interface UserPricingProfile {
  plano: PlanoAtivo;
  peticaoExpressDisponivel: boolean;
  recursoExpressDisponivel: boolean;
}

interface PricingSnapshot {
  planUnitPrices: Record<Exclude<PlanoAtivo, null>, number>;
  planLabels: Record<Exclude<PlanoAtivo, null>, string>;
  avulsoGrupoA: number;
  avulsoGrupoB: number;
  peticaoExpress: number;
  recursoExpress: number;
  loaded: boolean;
}

// Snapshot inicial vazio. Valores reais são populados por usePricingCatalog
// a partir de GET /api/plans + GET /api/catalog. Enquanto isLoading, a UI
// deve exibir estado de carregamento — nenhum preço hardcoded é usado.
const EMPTY_SNAPSHOT: PricingSnapshot = {
  planUnitPrices: { essencial: 0, profissional: 0, estrategico: 0 },
  planLabels: { essencial: "", profissional: "", estrategico: "" },
  avulsoGrupoA: 0,
  avulsoGrupoB: 0,
  peticaoExpress: 0,
  recursoExpress: 0,
  loaded: false,
};

let pricingSnapshot: PricingSnapshot = EMPTY_SNAPSHOT;

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const PLAN_BUCKETS: Exclude<PlanoAtivo, null>[] = ["essencial", "profissional", "estrategico"];

const PLAN_ALIASES: Record<Exclude<PlanoAtivo, null>, string[]> = {
  essencial: ["essencial", "starter", "start"],
  profissional: ["profissional", "pro"],
  estrategico: ["estrategico", "estrategico", "premium", "enterprise"],
};

const resolvePlanBucket = (plan: PublicPlan, index: number): Exclude<PlanoAtivo, null> | null => {
  const haystack = `${normalize(plan.code)} ${normalize(plan.name)}`;
  for (const bucket of PLAN_BUCKETS) {
    if (PLAN_ALIASES[bucket].some((alias) => haystack.includes(alias))) {
      return bucket;
    }
  }
  return PLAN_BUCKETS[index] ?? null;
};

const derivePlanUnitPrice = (plan: PublicPlan): number | null => {
  // Backend pode expor diretamente price_per_service_cents (preferido)
  // ou apenas monthly_price_cents + petition_limit_monthly.
  const direct = (plan as { price_per_service_cents?: number }).price_per_service_cents;
  if (direct && direct > 0) return roundCurrency(direct / 100);
  const petitionLimit = plan.petition_limit_monthly ?? 0;
  if (petitionLimit > 0 && plan.monthly_price_cents > 0) {
    return roundCurrency(plan.monthly_price_cents / 100 / petitionLimit);
  }
  return null;
};

const derivePricingSnapshot = (
  plans: PublicPlan[] | undefined,
  catalog: CatalogSection[] | undefined,
): PricingSnapshot => {
  const next: PricingSnapshot = {
    planUnitPrices: { ...EMPTY_SNAPSHOT.planUnitPrices },
    planLabels: { ...EMPTY_SNAPSHOT.planLabels },
    avulsoGrupoA: 0,
    avulsoGrupoB: 0,
    peticaoExpress: 0,
    recursoExpress: 0,
    loaded: Boolean(plans && plans.length > 0),
  };

  plans?.forEach((plan, index) => {
    const bucket = resolvePlanBucket(plan, index);
    if (!bucket) return;
    const unit = derivePlanUnitPrice(plan);
    if (unit !== null) next.planUnitPrices[bucket] = unit;
    if (plan.name) next.planLabels[bucket] = plan.name;
  });

  catalog?.forEach((section) => {
    const sectionKey = normalize(section.section);
    section.items.forEach((item) => {
      const key = `${normalize(item.code)} ${normalize(item.title)} ${sectionKey}`;
      const price = roundCurrency(item.unit_price / 100);
      const isExpress = key.includes("express");
      const isRecurso = key.includes("recurso");
      const isPeticao = key.includes("peticao") || key.includes("peticoes");

      if (isExpress && isPeticao) {
        next.peticaoExpress = price;
        return;
      }
      if (isExpress && isRecurso) {
        next.recursoExpress = price;
        return;
      }
      if (isRecurso || sectionKey.includes("recursos")) {
        next.avulsoGrupoB = price;
        return;
      }
      if (isPeticao || sectionKey.includes("peticoes")) {
        next.avulsoGrupoA = price;
      }
    });
  });

  return next;
};

export const usePricingCatalog = ({ includeCatalog = false }: { includeCatalog?: boolean } = {}) => {
  const plansQuery = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => api.content.plans(),
  });
  const catalogQuery = useQuery({
    queryKey: ["public-catalog"],
    queryFn: () => api.content.catalog(),
    enabled: includeCatalog,
  });

  const pricing = useMemo(
    () => derivePricingSnapshot(plansQuery.data?.plans, catalogQuery.data?.catalog),
    [catalogQuery.data?.catalog, plansQuery.data?.plans],
  );

  useEffect(() => {
    pricingSnapshot = pricing;
  }, [pricing]);

  return {
    data: pricing,
    isLoading: plansQuery.isLoading || (includeCatalog && catalogQuery.isLoading),
  };
};

export const PRECO_PLANO = {
  get essencial() { return pricingSnapshot.planUnitPrices.essencial; },
  get profissional() { return pricingSnapshot.planUnitPrices.profissional; },
  get estrategico() { return pricingSnapshot.planUnitPrices.estrategico; },
} as Record<Exclude<PlanoAtivo, null>, number>;

// Labels vêm do nome cadastrado no banco (Plan.name) via /api/plans.
// Enquanto a API não responde, retornamos string vazia — consumidores
// devem tratar como estado de carregamento.
export const LABEL_PLANO = {
  get essencial() { return pricingSnapshot.planLabels.essencial; },
  get profissional() { return pricingSnapshot.planLabels.profissional; },
  get estrategico() { return pricingSnapshot.planLabels.estrategico; },
} as Record<Exclude<PlanoAtivo, null>, string>;

export const isPricingLoaded = () => pricingSnapshot.loaded;

export const getPrecoAvulsoGrupoA = () => pricingSnapshot.avulsoGrupoA;
export const getPrecoAvulsoGrupoB = () => pricingSnapshot.avulsoGrupoB;
export const getPrecoPeticaoExpress = () => pricingSnapshot.peticaoExpress;
export const getPrecoRecursoExpress = () => pricingSnapshot.recursoExpress;

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
      precoPadrao = getPrecoAvulsoGrupoA();
      labelPadrao = "Petição Avulsa";
    } else {
      precoPadrao = getPrecoAvulsoGrupoB();
      labelPadrao = "Recurso Avulso";
    }
  }

  // Express é sempre opcional e adicional, independente do plano.
  let precoExpress: number | null = null;
  let labelExpress: string | null = null;
  if (grupo === "A" && perfil.peticaoExpressDisponivel) {
    precoExpress = getPrecoPeticaoExpress();
    labelExpress = "Petição Express";
  } else if (grupo === "B" && perfil.recursoExpressDisponivel) {
    precoExpress = getPrecoRecursoExpress();
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

import { useBalance } from "@/lib/balance";
import { useAuth } from "@/lib/auth";

/**
 * Perfil do cliente para o cálculo de preço.
 * - `plano`: vem do backend via /api/me (user.active_plan_id resolvido em
 *   alias). Quando o usuário NÃO tem plano, fica null.
 * - Disponibilidade Express: o backend não separa por carteira; a decisão
 *   final é tomada lá em _assert_sufficient_balance ao criar o pedido.
 *   Aqui usamos "saldo cobre o preço Express?" como pista de UI; um
 *   eventual erro do backend (saldo insuficiente) é mostrado por toast.
 */
export const useUserPricingProfile = () => {
  usePricingCatalog({ includeCatalog: true });
  const balance = useBalance();
  const { user } = useAuth();
  const planoCode = resolvePlanFromUser(user?.active_plan_id ?? null);
  const profile: UserPricingProfile = {
    plano: planoCode,
    peticaoExpressDisponivel: balance.saldoCents > 0,
    recursoExpressDisponivel: balance.saldoCents > 0,
  };
  return { data: profile } as { data: UserPricingProfile };
};

/** Mapeia o id do plano (que é mero foreign key) para o bucket usado pelo
 *  cálculo de preço. Como a tabela de planos canônicos hoje usa códigos
 *  estáveis (plano_essencial / plano_profissional / plano_estrategico),
 *  o backend retorna o id; aqui só falamos "tem plano" / "sem plano" e
 *  caímos em "essencial" por default quando há plano (preço Express usa
 *  esse bucket apenas como referência de UI). */
const resolvePlanFromUser = (
  activePlanId: number | null,
): UserPricingProfile["plano"] => {
  if (activePlanId == null) return null;
  // Sem informação detalhada do plano, assumimos "essencial" como base
  // segura — o preço final é sempre confirmado pelo backend no preview.
  return "essencial";
};

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
