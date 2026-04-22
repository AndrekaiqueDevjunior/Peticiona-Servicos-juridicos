// Cálculo de prazos de entrega por modalidade.
// - Planos / Avulsos: dias úteis (sem sábados, domingos e feriados nacionais BR).
// - Express: 24 horas corridas a partir da confirmação do pagamento.
// O prazo interno do funcionário é sempre 2 dias corridos antes do prazo do cliente.

import type { Modalidade, PlanoAtivo } from "@/lib/pricing";

export type ModalidadePrazo =
  | { tipo: "plano"; plano: Exclude<PlanoAtivo, null> }
  | { tipo: "avulso"; grupo: "A" | "B" }
  | { tipo: "express"; grupo: "A" | "B" };

export interface PrazoCalculado {
  /** ISO da entrega ao cliente */
  entregaClienteISO: string;
  /** ISO da entrega interna (2 dias corridos antes) */
  entregaInternaISO: string;
  /** Descrição do prazo (ex: "3 dias úteis", "24 horas corridas") */
  descricao: string;
}

// ---- Feriados nacionais BR (datas fixas + Páscoa móvel) -------------------

// Algoritmo de Meeus/Jones/Butcher para Domingo de Páscoa.
const calcularPascoa = (ano: number): Date => {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
};

const addDiasDate = (d: Date, dias: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const cacheFeriados = new Map<number, Set<string>>();

const feriadosDoAno = (ano: number): Set<string> => {
  const cached = cacheFeriados.get(ano);
  if (cached) return cached;

  const pascoa = calcularPascoa(ano);
  const carnavalTer = addDiasDate(pascoa, -47);
  const carnavalSeg = addDiasDate(pascoa, -48);
  const sextaSanta = addDiasDate(pascoa, -2);
  const corpusChristi = addDiasDate(pascoa, 60);

  const datas: Date[] = [
    new Date(ano, 0, 1),    // Confraternização Universal
    carnavalSeg,            // Carnaval (facultativo, mas tratado como feriado)
    carnavalTer,            // Carnaval
    sextaSanta,             // Sexta-feira Santa
    new Date(ano, 3, 21),   // Tiradentes
    new Date(ano, 4, 1),    // Dia do Trabalho
    corpusChristi,          // Corpus Christi
    new Date(ano, 8, 7),    // Independência
    new Date(ano, 9, 12),   // N. Sra. Aparecida
    new Date(ano, 10, 2),   // Finados
    new Date(ano, 10, 15),  // Proclamação da República
    new Date(ano, 10, 20),  // Consciência Negra
    new Date(ano, 11, 25),  // Natal
  ];

  const set = new Set(datas.map(ymd));
  cacheFeriados.set(ano, set);
  return set;
};

const isDiaUtil = (d: Date) => {
  const dow = d.getDay(); // 0=dom, 6=sab
  if (dow === 0 || dow === 6) return false;
  return !feriadosDoAno(d.getFullYear()).has(ymd(d));
};

/** Adiciona N dias úteis a uma data (preserva hora). */
export const addDiasUteis = (base: Date, dias: number): Date => {
  const r = new Date(base);
  let restantes = dias;
  while (restantes > 0) {
    r.setDate(r.getDate() + 1);
    if (isDiaUtil(r)) restantes -= 1;
  }
  return r;
};

// ---- Tabela de prazos por modalidade --------------------------------------

const PRAZO_DIAS_UTEIS: Record<string, number> = {
  essencial: 3,
  profissional: 3,
  estrategico: 2,
  avulso: 3,
};

/** Calcula o prazo de entrega ao cliente + interno. */
export const calcularPrazo = (
  modalidade: ModalidadePrazo,
  inicioPagamentoISO: string = new Date().toISOString(),
): PrazoCalculado => {
  const inicio = new Date(inicioPagamentoISO);
  let entregaCliente: Date;
  let descricao: string;

  if (modalidade.tipo === "express") {
    entregaCliente = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    descricao = "24 horas corridas";
  } else {
    const dias =
      modalidade.tipo === "plano"
        ? PRAZO_DIAS_UTEIS[modalidade.plano]
        : PRAZO_DIAS_UTEIS.avulso;
    entregaCliente = addDiasUteis(inicio, dias);
    descricao = `${dias} dias úteis`;
  }

  const entregaInterna = addDiasDate(entregaCliente, -2);

  return {
    entregaClienteISO: entregaCliente.toISOString(),
    entregaInternaISO: entregaInterna.toISOString(),
    descricao,
  };
};

/** Helper: deriva ModalidadePrazo a partir do estado do pricing. */
export const modalidadeParaPrazo = (params: {
  modalidadeEscolhida: Modalidade;
  grupo: "A" | "B" | null;
  plano: PlanoAtivo;
}): ModalidadePrazo | null => {
  const { modalidadeEscolhida, grupo, plano } = params;
  if (!grupo) return null;
  if (modalidadeEscolhida === "express") return { tipo: "express", grupo };
  if (plano) return { tipo: "plano", plano };
  return { tipo: "avulso", grupo };
};
