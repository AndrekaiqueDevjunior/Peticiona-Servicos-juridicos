// Store local (mock) dos pedidos do cliente.
// Captura todos os dados preenchidos no momento da criação para exibição
// no modal de detalhes (somente leitura).
// Substituir pelo backend quando o endpoint dedicado existir.

import { useSyncExternalStore } from "react";

export type PedidoStatus = "em_analise" | "aguardando_dados" | "concluido";

export const STATUS_LABEL: Record<PedidoStatus, string> = {
  em_analise: "Em análise",
  aguardando_dados: "Aguardando dados",
  concluido: "Concluído",
};

// Classes Tailwind usando tokens semânticos do design system.
export const STATUS_BADGE: Record<PedidoStatus, string> = {
  em_analise: "bg-primary/10 text-primary border border-primary/20",
  aguardando_dados:
    "bg-destructive/10 text-destructive border border-destructive/30",
  concluido: "bg-accent/15 text-accent border border-accent/30",
};

export const STATUS_DOT: Record<PedidoStatus, string> = {
  em_analise: "bg-primary",
  aguardando_dados: "bg-destructive",
  concluido: "bg-accent",
};

export interface PedidoParte {
  nome: string;
  tipo: string;
}

export interface PedidoAnexoOriginal {
  id: string;
  nome: string;
  tamanho: number;
  tipo: string;
}

export interface PedidoAnexoCliente {
  id: string;
  nome: string;
  tamanho: number;
  tipo: string;
  dataISO: string;
}

export interface PedidoComentario {
  id: string;
  autor: "cliente" | "equipe";
  autorNome: string;
  texto: string;
  dataISO: string;
  interno?: boolean; // comentários internos visíveis somente para a equipe
}

export interface PedidoEntregaFinal {
  id: string;
  nome: string;
  tamanho: number;
  tipo: string;
  dataISO: string;
  enviadoPor: string;
}

export interface Pedido {
  id: string;
  numero: number; // numeração sequencial começando em 1234
  reference: string;
  criadoEmISO: string;
  prazoEntregaClienteISO: string; // prazo final acordado com o cliente
  prazoEntregaInternoISO: string; // 2 dias antes do prazo do cliente
  status: PedidoStatus;
  statusAtualizadoEmISO: string;
  finalizadoEmISO?: string; // quando virou "concluido"

  // Dados do formulário (somente leitura)
  areaDireito: string;
  tipoPeticao: string;
  numeroProcesso: string;
  dataPublicacao: string; // yyyy-MM-dd ou ""
  competencia: string;
  comarca: string;
  justicaGratuita: boolean;
  tutelaUrgencia: boolean;
  advogadoSubscritor: string;
  resumoCaso: string;
  detalhes: string;
  partes: PedidoParte[];
  anexosOriginais: PedidoAnexoOriginal[];

  // Modalidade / preço
  modalidadeLabel: string; // ex: "Plano Profissional", "Padrão (Avulso)", "Petição Express"
  valor: number;

  // Pós-criação
  comentarios: PedidoComentario[];
  anexosCliente: PedidoAnexoCliente[];
}

interface PedidosState {
  pedidos: Pedido[];
}

const STORAGE_KEY = "peticiona:pedidos:v1";

const initialState: PedidosState = { pedidos: [] };

const load = (): PedidosState => {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
};

let state: PedidosState = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
};

const setState = (updater: (s: PedidosState) => PedidosState) => {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => state;

export const usePedidos = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const nextReference = (): string => {
  const ano = new Date().getFullYear();
  const seq = state.pedidos.length + 1;
  return `PT-${ano}-${String(seq).padStart(4, "0")}`;
};

export type CriarPedidoInput = Omit<
  Pedido,
  | "id"
  | "reference"
  | "criadoEmISO"
  | "status"
  | "statusAtualizadoEmISO"
  | "comentarios"
  | "anexosCliente"
>;

export const criarPedido = (input: CriarPedidoInput): Pedido => {
  const agora = new Date().toISOString();
  const novo: Pedido = {
    ...input,
    id: newId(),
    reference: nextReference(),
    criadoEmISO: agora,
    status: "em_analise",
    statusAtualizadoEmISO: agora,
    comentarios: [],
    anexosCliente: [],
  };
  setState((s) => ({ ...s, pedidos: [novo, ...s.pedidos] }));
  return novo;
};

export const adicionarComentario = (
  pedidoId: string,
  texto: string,
  autor: "cliente" | "equipe" = "cliente",
  autorNome = autor === "cliente" ? "Você" : "Equipe Peticiona",
) => {
  setState((s) => ({
    ...s,
    pedidos: s.pedidos.map((p) =>
      p.id === pedidoId
        ? {
            ...p,
            comentarios: [
              ...p.comentarios,
              {
                id: newId(),
                autor,
                autorNome,
                texto,
                dataISO: new Date().toISOString(),
              },
            ],
          }
        : p,
    ),
  }));
};

export const adicionarAnexosCliente = (pedidoId: string, files: File[]) => {
  if (!files.length) return;
  const novos: PedidoAnexoCliente[] = files.map((f) => ({
    id: newId(),
    nome: f.name,
    tamanho: f.size,
    tipo: f.type,
    dataISO: new Date().toISOString(),
  }));
  setState((s) => ({
    ...s,
    pedidos: s.pedidos.map((p) =>
      p.id === pedidoId
        ? { ...p, anexosCliente: [...p.anexosCliente, ...novos] }
        : p,
    ),
  }));
};

// Apenas para fins de demonstração / testes manuais — equipe interna.
export const atualizarStatus = (pedidoId: string, status: PedidoStatus) => {
  setState((s) => ({
    ...s,
    pedidos: s.pedidos.map((p) =>
      p.id === pedidoId
        ? { ...p, status, statusAtualizadoEmISO: new Date().toISOString() }
        : p,
    ),
  }));
};
