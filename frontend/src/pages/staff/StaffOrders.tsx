import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, FileText, Inbox, Loader2, Search } from "lucide-react";

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
  type StaffOrder,
  type StaffOrderStatus,
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

const formatBRLFromCents = (value: number) =>
  (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
            Cliente: {order.client_name ?? "Cliente não identificado"} · {order.total_brl}
          </p>
          <p className={cn("mt-1 inline-flex items-center gap-1 text-xs", prazoTone)}>
            <CalendarClock className="h-3.5 w-3.5" />
            Prazo: {formatDT(order.deadline_at)}
            {!concluido && sufixo}
          </p>
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

  if (!order) return null;

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
              <ReadonlyField label="Valor" value={order.total_brl || formatBRLFromCents(order.total_amount)} />
              {statusMutation.isPending && (
                <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </div>
              )}
            </CardContent>
          </Card>

          <ReadonlySection title="Serviço">
            <ReadonlyField label="Referência" value={order.reference} />
            <ReadonlyField label="Tipo" value={order.service_type} />
            <ReadonlyField label="Cliente" value={order.client_name ?? "—"} />
            <ReadonlyField label="Responsável" value={order.staff_name ?? "Sem vínculo"} />
            <ReadonlyField label="Concluído em" value={formatDT(order.completed_at, "—")} />
          </ReadonlySection>

          {order.petition && (
            <>
              <ReadonlySection title="Dados da solicitação">
                <ReadonlyField label="Área do Direito" value={order.petition.area_direito} />
                <ReadonlyField label="Tipo de petição" value={order.petition.tipo_peticao || "—"} />
                <ReadonlyField label="Número do processo" value={order.petition.numero_processo || "—"} />
                <ReadonlyField label="Advogado subscritor" value={order.petition.advogado_subscritor || "—"} />
              </ReadonlySection>
              <ReadonlyText title="Resumo do caso" value={order.petition.resumo_caso || "Sem resumo informado."} />
              <ReadonlyText title="Detalhes adicionais" value={order.petition.detalhes || "Sem detalhes adicionais."} />
            </>
          )}
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
