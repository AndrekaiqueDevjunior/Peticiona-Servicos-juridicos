import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Download, FileText, Inbox, Loader2, Paperclip, Search, Send, UploadCloud, UserRound, Zap } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  ApiError,
  api,
  isStaffOrderStatus,
  type AdminOrderStatus,
  type OrderComment,
  type StaffOrder,
  type StaffOrderStatus,
  type UploadedDocument,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pendente: "Em análise",
  em_andamento: "Aguardando dados",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_BADGE: Record<AdminOrderStatus, string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-destructive/10 text-destructive border border-destructive/30",
  concluido: "bg-accent/15 text-accent border border-accent/30",
  cancelado: "bg-muted text-muted-foreground border border-border",
};

const STATUS_DOT: Record<AdminOrderStatus, string> = {
  pendente: "bg-primary",
  em_andamento: "bg-destructive",
  concluido: "bg-accent",
  cancelado: "bg-muted-foreground",
};

const formatDT = (iso: string | null | undefined, fallback = "Sem data") => {
  if (!iso) return fallback;
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return fallback;
  }
};

const tipoCompleto = (order: StaffOrder) =>
  [order.service_type, order.petition?.area_direito, order.petition?.tipo_peticao]
    .filter(Boolean)
    .join(" → ");

export default function StaffOrders() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["staff-orders"],
    queryFn: () => api.staff.orders.list(),
    // Reflete mudanças de status feitas por cliente/admin sem refresh manual.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const orders = data?.orders ?? [];
  const ordenados = useMemo(
    () =>
      [...orders].sort((a, b) =>
        (a.deadline_at ?? a.created_at ?? "").localeCompare(b.deadline_at ?? b.created_at ?? ""),
      ),
    [orders],
  );
  const selected = selectedId ? orders.find((order) => order.id === selectedId) ?? null : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Bandeja de pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fila real de service_orders vinculados a você. Trabalhe pelo prazo interno.
          </p>
        </div>
        {!isLoading && (
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} na bandeja
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Fila de serviços</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando pedidos...
            </div>
          ) : ordenados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">Nenhum pedido na bandeja ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {ordenados.map((order) => (
                <StaffOrderRow key={order.id} order={order} onOpen={() => setSelectedId(order.id)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <StaffPedidoDialog order={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function StaffOrderRow({ order, onOpen }: { order: StaffOrder; onOpen: () => void }) {
  const deadline = order.deadline_at ? parseISO(order.deadline_at) : null;
  const horasRestantes = deadline ? (deadline.getTime() - Date.now()) / (1000 * 60 * 60) : null;
  const diasRestantes = deadline ? differenceInCalendarDays(deadline, new Date()) : null;
  const concluido = order.status === "concluido";
  const atrasado = horasRestantes !== null && horasRestantes < 0 && !concluido;
  const critico = !concluido && horasRestantes !== null && horasRestantes >= 0 && horasRestantes < 12;
  const urgente = !concluido && horasRestantes !== null && horasRestantes >= 12 && (diasRestantes ?? 99) <= 1;
  const prazoTone = atrasado || critico ? "text-destructive font-semibold" : urgente ? "text-accent" : "text-muted-foreground";
  const sufixo =
    horasRestantes === null
      ? ""
      : atrasado
        ? ` · atrasado ${Math.abs(Math.floor(horasRestantes))}h`
        : critico
          ? ` · vence em ${Math.max(1, Math.floor(horasRestantes))}h`
          : ` · em ${diasRestantes}d`;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between",
        (atrasado || critico) && "bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-secondary p-2">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {order.reference} · {tipoCompleto(order)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cliente: {order.client_name ?? "Cliente não identificado"} · Seu repasse:{" "}
            {order.staff_payout_brl}
          </p>
          <p className={cn("mt-1 inline-flex items-center gap-1 text-xs", prazoTone)}>
            <CalendarClock className="h-3.5 w-3.5" />
            Prazo: {formatDT(order.deadline_at)}
            {!concluido && sufixo}
          </p>
          {order.express_upgrade && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Zap className="h-3 w-3" />
              Express — prioridade máxima
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge status={order.status} />
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpen}
          aria-label={`Ver detalhes do pedido ${order.reference}`}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function StaffPedidoDialog({ order, onClose }: { order: StaffOrder | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comentario, setComentario] = useState("");

  const statusMutation = useMutation({
    mutationFn: (status: StaffOrderStatus) => api.staff.orders.updateStatus(order!.id, status),
    onSuccess: ({ order: updated }) => {
      queryClient.setQueryData<{ orders: StaffOrder[] }>(["staff-orders"], (old) =>
        old ? { orders: old.orders.map((item) => (item.id === updated.id ? updated : item)) } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["staff-orders"] });
      toast({ title: "Status do pedido atualizado." });
    },
    onError: (error) => {
      const description =
        error instanceof ApiError ? error.message : "Não foi possível salvar o status no backend.";
      toast({ title: "Erro ao salvar status.", description, variant: "destructive" });
    },
  });

  const { data: commentsData, isLoading: loadingComments } = useQuery({
    queryKey: ["order-comments", order?.id],
    queryFn: () => api.admin.orders.listComments(order!.id),
    enabled: !!order,
  });
  const comments = commentsData?.comments ?? [];

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => api.admin.orders.addComment(order!.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-comments", order?.id] });
      setComentario("");
      toast({ title: "Comentário publicado." });
    },
    onError: () => toast({ title: "Erro ao publicar comentário.", variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.admin.orders.uploadDocuments(order!.id, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-orders"] });
      toast({ title: "Documentos enviados com sucesso." });
    },
    onError: () => toast({ title: "Erro no upload.", variant: "destructive" }),
  });

  if (!order) return null;

  const docs: UploadedDocument[] = order.petition?.documents ?? [];

  const onUpload = (files: FileList | null) => {
    if (!files?.length) return;
    uploadMutation.mutate(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const ROLE_LABEL: Record<string, string> = { admin: "Admin", staff: "Equipe", client: "Cliente" };

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            Pedido {order.reference}
            <StatusBadge status={order.status} />
          </DialogTitle>
          <DialogDescription>
            Criado em {formatDT(order.created_at)} · Prazo: {formatDT(order.deadline_at, "Sem prazo")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Status do pedido
                </Label>
                <Select
                  value={order.status}
                  onValueChange={(value) => {
                    if (!isStaffOrderStatus(value)) {
                      toast({
                        title: "Status indisponível para equipe.",
                        description: "Apenas o admin pode aplicar este status.",
                        variant: "destructive",
                      });
                      return;
                    }
                    statusMutation.mutate(value);
                  }}
                  disabled={statusMutation.isPending || order.status === "cancelado"}
                >
                  <SelectTrigger className="w-full sm:w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Em análise</SelectItem>
                    <SelectItem value="em_andamento">Aguardando dados</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado" disabled>Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ReadonlyField
                label="Seu repasse"
                value={`${order.staff_payout_brl} (${order.split_funcionario}%)`}
              />
              {statusMutation.isPending && (
                <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Serviço */}
          <ReadonlySection title="Serviço">
            <ReadonlyField label="Referência" value={order.reference} />
            <ReadonlyField label="Tipo" value={order.service_type} />
            <ReadonlyField label="Cliente" value={order.client_name ?? "—"} />
            <ReadonlyField label="Responsável" value={order.staff_name ?? "Sem vínculo"} />
            <ReadonlyField label="Concluído em" value={formatDT(order.completed_at, "—")} />
          </ReadonlySection>

          {/* Dados completos da petição */}
          {order.petition && (
            <>
              <ReadonlySection title="Dados da solicitação">
                <ReadonlyField label="Área do Direito" value={order.petition.area_direito} />
                <ReadonlyField label="Tipo de petição" value={order.petition.tipo_peticao || "—"} />
                <ReadonlyField label="Número do processo" value={order.petition.numero_processo || "—"} />
                <ReadonlyField label="Data da publicação" value={order.petition.data_publicacao ? format(parseISO(order.petition.data_publicacao), "dd/MM/yyyy", { locale: ptBR }) : "—"} />
                <ReadonlyField label="Competência" value={(order.petition as any).competencia || "—"} />
                <ReadonlyField label="Comarca" value={(order.petition as any).comarca_uf || "—"} />
                <ReadonlyField label="Justiça gratuita" value={order.petition.justica_gratuita ? "Sim" : "Não"} />
                <ReadonlyField label="Tutela de urgência" value={order.petition.tutela_urgencia ? "Sim" : "Não"} />
                <ReadonlyField label="Advogado subscritor" value={order.petition.advogado_subscritor || "—"} />
              </ReadonlySection>

              <ReadonlyText title="Resumo do caso" value={order.petition.resumo_caso || "Sem resumo informado."} />
              <ReadonlyText title="Tópicos imprescindíveis" value={order.petition.detalhes || "Sem detalhes adicionais."} />

              {/* Partes */}
              {order.petition.partes?.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Partes do processo</h3>
                  <ul className="grid gap-2">
                    {order.petition.partes.map((parte, i) => (
                      <li key={i} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
                        <UserRound className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{parte.nome}</p>
                          <p className="text-xs text-muted-foreground">{parte.tipo}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {/* Documentos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Documentos</h3>
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
                  <li key={d.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
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
                        } catch (err) {
                          toast({ title: "Erro ao baixar documento.", variant: "destructive" });
                        }
                      }}
                    >
                      <Download className="h-3 w-3" />
                      Baixar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comentários */}
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
                {comments.map((c: OrderComment) => {
                  const roleColor: Record<string, string> = {
                    admin: "border-accent/40 bg-accent/10",
                    staff: "border-primary/20 bg-primary/5",
                    client: "border-border bg-muted/30",
                  };
                  return (
                    <li key={c.id} className={cn("rounded-md border p-3 text-sm", roleColor[c.author_role] ?? "border-border bg-muted/20")}>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {c.author_name}
                          <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            {ROLE_LABEL[c.author_role] ?? c.author_role}
                          </span>
                        </span>
                        <span>{formatDT(c.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-foreground">{c.text}</p>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Novo comentário</Label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escreva um comentário..."
                rows={3}
                disabled={addCommentMutation.isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { const t = comentario.trim(); if (t) addCommentMutation.mutate(t); }}
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

function StatusBadge({ status }: { status: AdminOrderStatus }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", STATUS_BADGE[status])}>
      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function ReadonlySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ReadonlyText({ title, value }: { title: string; value: string }) {
  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{value}</p>
    </section>
  );
}
