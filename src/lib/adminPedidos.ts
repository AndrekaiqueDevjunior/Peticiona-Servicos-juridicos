// Store reativo (mock, em memória) para a aba Admin → Pedidos.
// Substituir por queries reais quando o backend existir.

import { useSyncExternalStore } from "react";
import {
  ADMIN_PEDIDOS,
  ADMIN_FUNCIONARIOS,
  type AdminPedidoMock,
  type AdminPedidoComentario,
  type AdminPedidoAnexo,
} from "./adminMocks";
import { notifyOrderEvent } from "./orderEmailNotify";

const ADMIN_USER = "Admin Peticiona";

let pedidos: AdminPedidoMock[] = [...ADMIN_PEDIDOS];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => pedidos;

export const useAdminPedidos = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const update = (id: string, patch: (p: AdminPedidoMock) => AdminPedidoMock) => {
  pedidos = pedidos.map((p) => (p.id === id ? patch(p) : p));
  emit();
};

const pushHistorico = (p: AdminPedidoMock, texto: string): AdminPedidoMock => ({
  ...p,
  historico: [
    ...p.historico,
    { id: newId(), texto, dataISO: new Date().toISOString() },
  ],
});

// ---- Vinculação ------------------------------------------------------------

export const ADMIN_RESPONSAVEL_ID = "__admin__";

export const vincularResponsavel = (
  pedidoId: string,
  funcionarioId: string | null,
) => {
  update(pedidoId, (p) => {
    if (funcionarioId === null) {
      const nomeAnterior = p.funcionario;
      return pushHistorico(
        { ...p, funcionarioId: null, funcionario: null },
        nomeAnterior
          ? `Vínculo removido (${nomeAnterior}) por ${ADMIN_USER}.`
          : `Vínculo removido por ${ADMIN_USER}.`,
      );
    }
    if (funcionarioId === ADMIN_RESPONSAVEL_ID) {
      return pushHistorico(
        {
          ...p,
          funcionarioId: ADMIN_RESPONSAVEL_ID,
          funcionario: ADMIN_USER,
        },
        `Pedido atribuído ao ${ADMIN_USER} por ele mesmo.`,
      );
    }
    const f = ADMIN_FUNCIONARIOS.find((x) => x.id === funcionarioId);
    if (!f) return p;
    return pushHistorico(
      { ...p, funcionarioId: f.id, funcionario: f.nome },
      `Pedido vinculado a ${f.nome} por ${ADMIN_USER}.`,
    );
  });
};

// ---- Prazo de entrega (admin pode editar) ---------------------------------

export const alterarPrazoCliente = (
  pedidoId: string,
  novoPrazoISO: string,
) => {
  update(pedidoId, (p) => {
    if (p.prazoClienteISO === novoPrazoISO) return p;
    const nova = new Date(novoPrazoISO);
    if (Number.isNaN(nova.getTime())) return p;
    // Recalcula prazo interno: 2 dias antes (mantém igual ao cliente quando express).
    const isExpress = p.modalidade === "peticao_express" || p.modalidade === "recurso_express";
    const interno = isExpress
      ? new Date(nova)
      : new Date(nova.getTime() - 2 * 24 * 60 * 60 * 1000);
    const formatado = nova.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const prazoCliente = `${String(nova.getDate()).padStart(2, "0")}/${String(nova.getMonth() + 1).padStart(2, "0")}/${nova.getFullYear()}`;
    return pushHistorico(
      {
        ...p,
        prazoClienteISO: nova.toISOString(),
        prazoInternoISO: interno.toISOString(),
        prazoCliente,
      },
      `Prazo de entrega alterado para ${formatado} por ${ADMIN_USER}.`,
    );
  });
};

// ---- Status ----------------------------------------------------------------

export const alterarStatus = (
  pedidoId: string,
  status: AdminPedidoMock["status"],
) => {
  update(pedidoId, (p) =>
    pushHistorico(
      {
        ...p,
        status,
        finalizadoEm:
          status === "Concluído"
            ? p.finalizadoEm ??
              new Date().toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : p.finalizadoEm,
      },
      `Status alterado para "${status}" por ${ADMIN_USER}.`,
    ),
  );
};

// ---- Split -----------------------------------------------------------------

export const atualizarSplit = (
  pedidoId: string,
  splitPlataforma: number,
  splitFuncionario: number,
) => {
  const sp = Math.max(0, Math.min(100, Math.round(splitPlataforma)));
  const sf = Math.max(0, Math.min(100, Math.round(splitFuncionario)));
  if (sp + sf !== 100) return;
  update(pedidoId, (p) => {
    if (p.splitPlataforma === sp && p.splitFuncionario === sf) return p;
    return pushHistorico(
      { ...p, splitPlataforma: sp, splitFuncionario: sf },
      `Split alterado para ${sp}% plataforma / ${sf}% funcionário por ${ADMIN_USER}.`,
    );
  });
};

// ---- Comentários -----------------------------------------------------------

export const adicionarComentarioAdmin = (pedidoId: string, texto: string) => {
  const t = texto.trim();
  if (!t) return;
  let pedidoRef: { numero: number; cliente: string } | null = null;
  update(pedidoId, (p) => {
    pedidoRef = { numero: p.numero, cliente: p.cliente };
    return {
      ...p,
      comentarios: [
        ...p.comentarios,
        {
          id: newId(),
          autorNome: ADMIN_USER,
          autorRole: "admin",
          texto: t,
          dataISO: new Date().toISOString(),
        } satisfies AdminPedidoComentario,
      ],
    };
  });
  if (pedidoRef) {
    void notifyOrderEvent({
      event: "comentario_publicado",
      pedidoNumero: pedidoRef.numero,
      cliente: pedidoRef.cliente,
      autor: ADMIN_USER,
      detalhes: t,
    });
  }
};

export const excluirComentarioAdmin = (pedidoId: string, comentarioId: string) => {
  update(pedidoId, (p) => ({
    ...p,
    comentarios: p.comentarios.filter((c) => c.id !== comentarioId),
  }));
};

// ---- Anexos ----------------------------------------------------------------

export const adicionarAnexosAdmin = (pedidoId: string, files: File[]) => {
  if (!files.length) return;
  const novos: AdminPedidoAnexo[] = files.map((f) => ({
    id: newId(),
    nome: f.name,
    tamanho: f.size,
    enviadoPor: ADMIN_USER,
    dataISO: new Date().toISOString(),
  }));
  update(pedidoId, (p) => ({ ...p, anexos: [...p.anexos, ...novos] }));
};

export const excluirAnexoAdmin = (pedidoId: string, anexoId: string) => {
  update(pedidoId, (p) => ({
    ...p,
    anexos: p.anexos.filter((a) => a.id !== anexoId),
  }));
};
