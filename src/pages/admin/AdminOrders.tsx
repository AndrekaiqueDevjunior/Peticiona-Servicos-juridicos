import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  Inbox,
  Loader2,
  Paperclip,
  Search,
  Send,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ApiError, api, isAdminOrderStatus, type AdminOrder, type AdminOrderStatus, type OrderComment } from "@/lib/api";

// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<AdminOrder["status"], string> = {
  pendente: "Em análise",
  em_andamento: "Aguardando dados",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_BADGE: Record<AdminOrder["status"], string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-destructive/10 text-destructive border border-destructive/30",
  concluido: "bg-accent/15 text-accent border border-accent/30",
  cancelado: "bg-muted text-muted-foreground border border-border",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  staff: "Equipe",
  client: "Cliente",
};

const UNASSIGNED_STAFF_VALUE = "__sem_responsavel__";
const UNASSIGNED_CLIENT_VALUE = "__sem_cliente__";

const formatDT = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—";

const isoToInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ---------------------------------------------------------------------------

export default function AdminOrders() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => api.admin.orders.list(),
  });

  const orders = data?.orders ?? [];
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Todos os pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão completa: altere status, adicione anexos e comente em tempo real.
          </p>
        </div>
        {!isLoading && (
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            {orders.length} pedidos
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Pedidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando pedidos...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">Nenhum pedido encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.numero}</TableCell>
                    <TableCell>{o.cliente}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.tipo_servico}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", STATUS_BADGE[o.status])}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{o.valor_brl}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.prazo_cliente ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedId(o.id)}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PedidoModal order={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal completo com dados reais
// ---------------------------------------------------------------------------

function PedidoModal({ order, onClose }: { order: AdminOrder | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comentario, setComentario] = useState("");
  const [orderForm, setOrderForm] = useState({
    numero: "",
    userId: UNASSIGNED_CLIENT_VALUE,
    tipoServico: "",
    valor: "0",
    deadlineAt: "",
    finalizadoEm: "",
    splitPlataforma: "100",
    splitFuncionario: "0",
  });
  const [petitionForm, setPetitionForm] = useState({
    areaDireito: "",
    tipoPeticao: "",
    numeroProcesso: "",
    dataPublicacao: "",
    justicaGratuita: false,
    tutelaUrgencia: false,
    advogadoSubscritor: "",
    resumoCaso: "",
    detalhes: "",
    partesText: "",
  });

  // Comentários
  const { data: commentsData, isLoading: loadingComments } = useQuery({
    queryKey: ["order-comments", order?.id],
    queryFn: () => api.admin.orders.listComments(order!.id),
    enabled: !!order,
  });
  const comments = commentsData?.comments ?? [];

  const { data: staffData, isLoading: loadingStaff } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => api.admin.staff.list(),
    enabled: !!order,
  });

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => api.admin.clients.list(),
    enabled: !!order,
  });

  useEffect(() => {
    if (!order) return;
    setOrderForm({
      numero: order.numero ?? "",
      userId: order.user_id?.toString() ?? UNASSIGNED_CLIENT_VALUE,
      tipoServico: order.tipo_servico ?? "",
      valor: String(order.valor ?? 0),
      deadlineAt: isoToInput(order.prazo_cliente_iso),
      finalizadoEm: isoToInput(order.finalizado_em_iso),
      splitPlataforma: String(order.split_plataforma ?? 100),
      splitFuncionario: String(order.split_funcionario ?? 0),
    });
    setPetitionForm({
      areaDireito: order.petition?.area_direito ?? "",
      tipoPeticao: order.petition?.tipo_peticao ?? "",
      numeroProcesso: order.petition?.numero_processo ?? "",
      dataPublicacao: order.petition?.data_publicacao ?? "",
      justicaGratuita: !!order.petition?.justica_gratuita,
      tutelaUrgencia: !!order.petition?.tutela_urgencia,
      advogadoSubscritor: order.petition?.advogado_subscritor ?? "",
      resumoCaso: order.petition?.resumo_caso ?? "",
      detalhes: order.petition?.detalhes ?? "",
      partesText:
        order.petition?.partes.map((parte) => `${parte.tipo || ""} | ${parte.nome || ""}`).join("\n") ?? "",
    });
  }, [order]);

  // Mutation: status/prazo
  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.admin.orders.update>[1]) =>
      api.admin.orders.update(order!.id, payload),
    onSuccess: ({ order: updated }) => {
      queryClient.setQueryData<{ orders: AdminOrder[] }>(["admin-orders"], (old) =>
        old ? { orders: old.orders.map((o) => (o.id === updated.id ? updated : o)) } : old
      );
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      toast({ title: "Pedido atualizado." });
    },
    onError: (error) => {
      const description =
        error instanceof ApiError ? error.message : "Não foi possível salvar a alteração.";
      toast({ title: "Erro ao salvar.", description, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: AdminOrderStatus) => api.admin.orders.updateStatus(order!.id, status),
    onSuccess: ({ order: updated }) => {
      queryClient.setQueryData<{ orders: AdminOrder[] }>(["admin-orders"], (old) =>
        old ? { orders: old.orders.map((o) => (o.id === updated.id ? updated : o)) } : old
      );
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      queryClient.invalidateQueries({ queryKey: ["admin-financial"] });
      toast({ title: "Status do pedido atualizado." });
    },
    onError: (error) => {
      const description =
        error instanceof ApiError ? error.message : "Não foi possível salvar o status no backend.";
      toast({
        title: "Erro ao salvar status.",
        description,
        variant: "destructive",
      });
    },
  });

  // Mutation: upload
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.admin.orders.uploadDocuments(order!.id, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Documentos enviados com sucesso." });
    },
    onError: () => toast({ title: "Erro no upload.", variant: "destructive" }),
  });

  // Mutation: add comment
  const addCommentMutation = useMutation({
    mutationFn: (text: string) => api.admin.orders.addComment(order!.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-comments", order?.id] });
      setComentario("");
      toast({ title: "Comentário publicado." });
    },
    onError: () => toast({ title: "Erro ao publicar comentário.", variant: "destructive" }),
  });

  // Mutation: delete comment
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => api.admin.orders.deleteComment(order!.id, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-comments", order?.id] });
      toast({ title: "Comentário excluído." });
    },
  });

  if (!order) return null;

  const onUpload = (files: FileList | null) => {
    if (!files?.length) return;
    uploadMutation.mutate(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onComentar = () => {
    const t = comentario.trim();
    if (!t) return;
    addCommentMutation.mutate(t);
  };

  const saveOrderDetails = () => {
    const valor = Number(orderForm.valor);
    const splitPlataforma = Number(orderForm.splitPlataforma);
    const splitFuncionario = Number(orderForm.splitFuncionario);
    const userId = orderForm.userId === UNASSIGNED_CLIENT_VALUE ? null : Number(orderForm.userId);

    if (!orderForm.numero.trim() || !orderForm.tipoServico.trim()) {
      toast({
        title: "Campos obrigatórios.",
        description: "Referência e serviço não podem ficar vazios.",
        variant: "destructive",
      });
      return;
    }

    if (
      Number.isNaN(valor) ||
      valor < 0 ||
      Number.isNaN(splitPlataforma) ||
      Number.isNaN(splitFuncionario) ||
      splitPlataforma < 0 ||
      splitFuncionario < 0
    ) {
      toast({
        title: "Valores inválidos.",
        description: "Valor e splits precisam ser números positivos.",
        variant: "destructive",
      });
      return;
    }

    if (splitPlataforma + splitFuncionario !== 100) {
      toast({
        title: "Split inválido.",
        description: "Split plataforma + split funcionário precisa totalizar 100%.",
        variant: "destructive",
      });
      return;
    }

    if (userId !== null && Number.isNaN(userId)) {
      toast({
        title: "Cliente inválido.",
        description: "Selecione um cliente válido para o pedido.",
        variant: "destructive",
      });
      return;
    }

    const partes = petitionForm.partesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.includes("|") ? "|" : ":";
        const [tipo, ...nomeParts] = line.split(separator);
        return {
          tipo: (tipo ?? "").trim(),
          nome: nomeParts.join(separator).trim(),
        };
      });

    if (order.petition && !petitionForm.areaDireito.trim()) {
      toast({
        title: "Área do Direito obrigatória.",
        description: "Preencha a área do Direito nos dados da solicitação.",
        variant: "destructive",
      });
      return;
    }

    if (order.petition && partes.some((parte) => !parte.nome || !parte.tipo)) {
      toast({
        title: "Partes inválidas.",
        description: "Use uma linha por parte no formato: Tipo | Nome.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      numero: orderForm.numero.trim(),
      user_id: userId,
      tipo_servico: orderForm.tipoServico.trim(),
      valor: Math.round(valor),
      deadline_at: orderForm.deadlineAt ? new Date(orderForm.deadlineAt).toISOString() : null,
      finalizado_em: orderForm.finalizadoEm ? new Date(orderForm.finalizadoEm).toISOString() : null,
      split_plataforma: Math.round(splitPlataforma),
      split_funcionario: Math.round(splitFuncionario),
      ...(order.petition
        ? {
            petition: {
              area_direito: petitionForm.areaDireito.trim(),
              tipo_peticao: petitionForm.tipoPeticao.trim() || null,
              numero_processo: petitionForm.numeroProcesso.trim() || null,
              data_publicacao: petitionForm.dataPublicacao.trim() || null,
              justica_gratuita: petitionForm.justicaGratuita,
              tutela_urgencia: petitionForm.tutelaUrgencia,
              advogado_subscritor: petitionForm.advogadoSubscritor.trim() || null,
              resumo_caso: petitionForm.resumoCaso.trim() || null,
              detalhes: petitionForm.detalhes.trim() || null,
              partes,
            },
          }
        : {}),
    });
  };

  const docs = order.petition?.documents ?? [];
  const clients = clientsData?.clients ?? [];
  const hasCurrentClient =
    order.user_id != null && clients.some((client) => client.id === order.user_id);
  const staffMembers = staffData?.staff ?? [];
  const staffOptions = staffMembers.filter((staff) => staff.ativo || staff.id === order.staff_user_id);
  const hasCurrentStaff =
    order.staff_user_id != null && staffOptions.some((staff) => staff.id === order.staff_user_id);

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            Pedido {order.numero}
            <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", STATUS_BADGE[order.status])}>
              {STATUS_LABEL[order.status]}
            </span>
          </DialogTitle>
          <DialogDescription>Visão administrativa · gestão completa do pedido</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Painel de ações */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                <Select
                  value={order.status}
                  onValueChange={(v) => {
                    if (!isAdminOrderStatus(v)) {
                      toast({
                        title: "Status inválido.",
                        description: "A alteração não foi enviada ao backend.",
                        variant: "destructive",
                      });
                      return;
                    }
                    statusMutation.mutate(v);
                  }}
                  disabled={statusMutation.isPending || updateMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Em análise</SelectItem>
                    <SelectItem value="em_andamento">Aguardando dados</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Responsável</Label>
                <Select
                  value={order.staff_user_id?.toString() ?? UNASSIGNED_STAFF_VALUE}
                  onValueChange={(v) => {
                    const staffUserId = v === UNASSIGNED_STAFF_VALUE ? null : Number(v);
                    if (staffUserId !== null && Number.isNaN(staffUserId)) {
                      toast({
                        title: "Responsável inválido.",
                        description: "A alteração não foi enviada ao backend.",
                        variant: "destructive",
                      });
                      return;
                    }
                    updateMutation.mutate({ staff_user_id: staffUserId });
                  }}
                  disabled={updateMutation.isPending || loadingStaff}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingStaff ? "Carregando..." : "Sem vínculo"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_STAFF_VALUE}>Sem vínculo</SelectItem>
                    {staffOptions.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id.toString()}>
                        {staff.nome}
                        {!staff.ativo ? " (bloqueado)" : ""}
                      </SelectItem>
                    ))}
                    {!hasCurrentStaff && order.staff_user_id != null && order.funcionario && (
                      <SelectItem value={order.staff_user_id.toString()}>{order.funcionario}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Referência</Label>
                <Input
                  value={orderForm.numero}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, numero: e.target.value }))}
                  disabled={updateMutation.isPending}
                  maxLength={40}
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
                <Select
                  value={orderForm.userId}
                  onValueChange={(value) => setOrderForm((prev) => ({ ...prev, userId: value }))}
                  disabled={updateMutation.isPending || loadingClients}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingClients ? "Carregando clientes..." : "Sem cliente"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_CLIENT_VALUE}>Sem cliente</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.nome}
                        {!client.ativo ? " (suspenso)" : ""}
                      </SelectItem>
                    ))}
                    {!hasCurrentClient && order.user_id != null && (
                      <SelectItem value={order.user_id.toString()}>{order.cliente}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Serviço</Label>
                <Input
                  value={orderForm.tipoServico}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, tipoServico: e.target.value }))}
                  disabled={updateMutation.isPending}
                  maxLength={120}
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Valor do pedido (centavos)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={orderForm.valor}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, valor: e.target.value }))}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Prazo de entrega ao cliente
                </Label>
                <Input
                  type="datetime-local"
                  value={orderForm.deadlineAt}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, deadlineAt: e.target.value }))}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Finalizado em</Label>
                <Input
                  type="datetime-local"
                  value={orderForm.finalizadoEm}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, finalizadoEm: e.target.value }))}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Split plataforma (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={orderForm.splitPlataforma}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, splitPlataforma: e.target.value }))}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Split funcionário (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={orderForm.splitFuncionario}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, splitFuncionario: e.target.value }))}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex justify-end sm:col-span-2">
                <Button type="button" variant="outline" onClick={saveOrderDetails} disabled={updateMutation.isPending}>
                  Salvar dados do pedido
                </Button>
              </div>

              {(statusMutation.isPending || updateMutation.isPending) && (
                <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo */}
          <Section title="Serviço">
            <Field label="Referência" value={order.numero} />
            <Field label="Tipo" value={order.tipo_servico} />
            <Field label="Cliente" value={order.cliente} />
            <Field label="Valor" value={order.valor_brl} />
            <Field label="Prazo cliente" value={order.prazo_cliente ?? "—"} />
            <Field label="Criado em" value={order.criado_em} />
            <Field label="Finalizado em" value={order.finalizado_em ?? "—"} />
            {order.split_plataforma != null && (
              <Field label="Split (plat./func.)" value={`${order.split_plataforma}% / ${order.split_funcionario ?? 0}%`} />
            )}
          </Section>

          {/* Dados da petição */}
          {order.petition && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Dados da solicitação</h3>
              <div className="grid gap-4 rounded-md border border-border bg-card p-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Área do Direito</Label>
                  <Input
                    value={petitionForm.areaDireito}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, areaDireito: e.target.value }))}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo de petição</Label>
                  <Input
                    value={petitionForm.tipoPeticao}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, tipoPeticao: e.target.value }))}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Data da publicação</Label>
                  <Input
                    value={petitionForm.dataPublicacao}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, dataPublicacao: e.target.value }))}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Número do processo</Label>
                  <Input
                    value={petitionForm.numeroProcesso}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, numeroProcesso: e.target.value }))}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={petitionForm.justicaGratuita}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, justicaGratuita: e.target.checked }))}
                    disabled={updateMutation.isPending}
                  />
                  Justiça gratuita
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={petitionForm.tutelaUrgencia}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, tutelaUrgencia: e.target.checked }))}
                    disabled={updateMutation.isPending}
                  />
                  Tutela de urgência
                </label>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Partes do processo</Label>
                  <Textarea
                    value={petitionForm.partesText}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, partesText: e.target.value }))}
                    placeholder="Autor | Maria Silva&#10;Réu | Empresa XPTO"
                    rows={4}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Resumo do caso</Label>
                  <Textarea
                    value={petitionForm.resumoCaso}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, resumoCaso: e.target.value }))}
                    rows={4}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Tópicos imprescindíveis</Label>
                  <Textarea
                    value={petitionForm.detalhes}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, detalhes: e.target.value }))}
                    rows={4}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Advogado subscritor</Label>
                  <Input
                    value={petitionForm.advogadoSubscritor}
                    onChange={(e) => setPetitionForm((prev) => ({ ...prev, advogadoSubscritor: e.target.value }))}
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Documentos com download e upload */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">5. Documentos</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}
                Adicionar anexo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onUpload(e.target.files)}
              />
            </div>

            {docs.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Nenhum documento enviado.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-foreground">{d.file_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{d.size_label}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-1 h-8 shrink-0 gap-1.5 px-2 text-xs"
                      onClick={async () => {
                        try {
                          await api.documents.download(d);
                        } catch (error) {
                          const description =
                            error instanceof ApiError
                              ? error.message
                              : "Não foi possível baixar o documento.";
                          toast({
                            title: "Erro ao baixar documento.",
                            description,
                            variant: "destructive",
                          });
                        }
                      }}
                      aria-label={`Baixar ${d.file_name}`}
                    >
                      <Download className="h-3 w-3" />
                      Baixar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comentários reais */}
          <section className="space-y-3 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground">Comentários</h3>

            {loadingComments ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : comments.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Nenhum comentário ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    onDelete={() => deleteCommentMutation.mutate(c.id)}
                    deleting={deleteCommentMutation.isPending}
                  />
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Novo comentário (admin)
              </Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escreva um comentário..."
                rows={3}
                disabled={addCommentMutation.isPending}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={onComentar}
                  disabled={!comentario.trim() || addCommentMutation.isPending}
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Publicar
                </Button>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function CommentItem({
  comment,
  onDelete,
  deleting,
}: {
  comment: OrderComment;
  onDelete: () => void;
  deleting: boolean;
}) {
  const roleColor: Record<string, string> = {
    admin: "border-accent/40 bg-accent/10",
    staff: "border-primary/20 bg-primary/5",
    client: "border-border bg-muted/30",
  };

  return (
    <li className={cn("rounded-md border p-3 text-sm", roleColor[comment.author_role] ?? "border-border bg-muted/20")}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {comment.author_name}
          <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {ROLE_LABEL[comment.author_role] ?? comment.author_role}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <span>{formatDT(comment.created_at)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Excluir comentário"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.text}</p>
    </li>
  );
}

// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
