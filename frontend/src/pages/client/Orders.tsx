import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  CreditCard,
  Eye,
  FileText,
  Filter,
  Loader2,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ApiError, api } from "@/lib/api";
import type { CheckoutOrderType } from "@/lib/api";
import {
  STATUS_LABEL,
  STATUS_TONE,
  formatAmountFromCents,
  isTerminalStatus,
  type CheckoutOrderStatus,
} from "@/lib/checkoutApi";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EDITABLE_STATUSES = new Set<CheckoutOrderStatus>(["pending", "failed"]);
const CANCELLABLE_STATUSES = new Set<CheckoutOrderStatus>([
  "pending",
  "failed",
  "processing",
  "waiting_payment",
]);
const PAYABLE_STATUSES = new Set<CheckoutOrderStatus>([
  "pending",
  "failed",
  "waiting_payment",
]);

const TONE_CLASS: Record<"neutral" | "warning" | "success" | "danger", string> = {
  neutral: "bg-gray-100 text-gray-900",
  warning: "bg-yellow-100 text-yellow-900",
  success: "bg-emerald-100 text-emerald-900",
  danger: "bg-red-100 text-red-900",
};

export default function Orders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["client-checkout-orders"],
    queryFn: () => api.clientArea.checkoutOrders(),
  });

  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData?.orders]);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  const [viewOrder, setViewOrder] = useState<CheckoutOrderType | null>(null);
  const [editOrder, setEditOrder] = useState<CheckoutOrderType | null>(null);
  const [cancelOrder, setCancelOrder] = useState<CheckoutOrderType | null>(null);

  const statusOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (!map.has(o.status)) map.set(o.status, STATUS_LABEL[o.status] || o.status);
    });
    return [{ value: "todos", label: "Todos os status" }].concat(
      Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    );
  }, [orders]);

  const pedidosFiltrados = useMemo(() => {
    return orders.filter((o) => {
      if (statusFiltro !== "todos" && o.status !== statusFiltro) return false;
      if (!dataInicio && !dataFim) return true;
      try {
        const created = parseISO(o.created_at);
        const start = dataInicio ? startOfDay(dataInicio) : new Date(0);
        const end = dataFim ? endOfDay(dataFim) : new Date(8.64e15);
        return isWithinInterval(created, { start, end });
      } catch { return true; }
    });
  }, [orders, statusFiltro, dataInicio, dataFim]);

  const limparFiltros = () => {
    setStatusFiltro("todos");
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const filtrosAtivos = statusFiltro !== "todos" || !!dataInicio || !!dataFim;

  const cancelMutation = useMutation({
    mutationFn: (id: number | string) => api.clientArea.cancelCheckoutOrder(id),
    onSuccess: () => {
      toast({ title: "Pedido cancelado", description: "Seu pedido foi cancelado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["client-checkout-orders"] });
      setCancelOrder(null);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Não foi possível cancelar o pedido.";
      toast({ title: "Erro ao cancelar", description: msg, variant: "destructive" });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meus pedidos
        </h1>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="h-9 w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DateFilter label="Data inicial" value={dataInicio} placeholder="De" onSelect={setDataInicio} />
          <DateFilter label="Data final" value={dataFim} placeholder="Até" onSelect={setDataFim} />

          {filtrosAtivos && (
            <Button type="button" variant="ghost" size="sm" onClick={limparFiltros} className="h-9">
              Limpar
            </Button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {pedidosFiltrados.length} de {orders.length} pedidos
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-14 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido ainda. Use o botão "Novo pedido" para começar.
            </p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido corresponde aos filtros selecionados.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pedidosFiltrados.map((order) => {
                const tone = STATUS_TONE[order.status] ?? "neutral";
                const canEdit = EDITABLE_STATUSES.has(order.status);
                const canCancel = CANCELLABLE_STATUSES.has(order.status);
                const canPay = PAYABLE_STATUSES.has(order.status);
                return (
                  <li
                    key={order.id}
                    className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-secondary p-2">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {order.service_name || order.service_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID: {order.id}
                          {" · "}
                          {format(parseISO(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          {" · "}
                          {formatAmountFromCents(order.amount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
                          TONE_CLASS[tone],
                        )}
                      >
                        {STATUS_LABEL[order.status]}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Ver detalhes"
                        aria-label="Ver detalhes do pedido"
                        onClick={() => setViewOrder(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canPay && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          title="Pagar pedido"
                          onClick={() => navigate(`/checkout/${order.id}`)}
                        >
                          <CreditCard className="mr-1.5 h-4 w-4" />
                          Pagar
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Editar pedido"
                          aria-label="Editar pedido"
                          onClick={() => setEditOrder(order)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Cancelar pedido"
                          aria-label="Cancelar pedido"
                          onClick={() => setCancelOrder(order)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ViewOrderDialog order={viewOrder} onClose={() => setViewOrder(null)} />
      <EditOrderDialog
        order={editOrder}
        onClose={() => setEditOrder(null)}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["client-checkout-orders"] })}
      />
      <AlertDialog open={!!cancelOrder} onOpenChange={(open) => !open && setCancelOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelOrder
                ? `Pedido #${cancelOrder.id} — ${cancelOrder.service_name || cancelOrder.service_id}. Esta ação não pode ser desfeita.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (cancelOrder) cancelMutation.mutate(cancelOrder.id);
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ViewOrderDialog({
  order,
  onClose,
}: {
  order: CheckoutOrderType | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes do pedido</DialogTitle>
          <DialogDescription>
            {order ? `Pedido #${order.id}` : ""}
          </DialogDescription>
        </DialogHeader>
        {order && (
          <div className="space-y-3 text-sm">
            <DetailRow label="Serviço" value={order.service_name || order.service_id} />
            <DetailRow label="Código" value={order.service_id} />
            <DetailRow label="Valor" value={formatAmountFromCents(order.amount)} />
            <DetailRow label="Status" value={STATUS_LABEL[order.status]} />
            <DetailRow
              label="Criado em"
              value={format(parseISO(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            />
            {order.paid_at && (
              <DetailRow
                label="Pago em"
                value={format(parseISO(order.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              />
            )}
            {order.pagarme_order_id && (
              <DetailRow label="Pagar.me Order" value={order.pagarme_order_id} />
            )}
            {order.pagarme_charge_id && (
              <DetailRow label="Pagar.me Charge" value={order.pagarme_charge_id} />
            )}
            <DetailRow
              label="Finalizado"
              value={isTerminalStatus(order.status) ? "Sim" : "Em aberto"}
            />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-border py-1.5 last:border-0">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function EditOrderDialog({
  order,
  onClose,
  onUpdated,
}: {
  order: CheckoutOrderType | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [serviceId, setServiceId] = useState<string>("");

  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ["client-area-catalog"],
    queryFn: () => api.clientArea.catalog(),
    enabled: !!order,
  });

  useEffect(() => {
    if (order) setServiceId(order.service_id);
  }, [order]);

  const mutation = useMutation({
    mutationFn: (newServiceId: string) =>
      api.clientArea.updateCheckoutOrder(order!.id, { service_id: newServiceId }),
    onSuccess: () => {
      toast({ title: "Pedido atualizado", description: "Os dados do pedido foram alterados." });
      onUpdated();
      onClose();
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Não foi possível atualizar.";
      toast({ title: "Erro ao atualizar", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!serviceId || !order) return;
    if (serviceId === order.service_id) {
      toast({ title: "Nenhuma alteração", description: "Selecione um serviço diferente para salvar." });
      return;
    }
    mutation.mutate(serviceId);
  };

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar pedido</DialogTitle>
          <DialogDescription>
            {order ? `Pedido #${order.id} — altere o serviço contratado.` : ""}
          </DialogDescription>
        </DialogHeader>
        {order && (
          <div className="space-y-4 text-sm">
            <div>
              <Label className="text-xs">Serviço atual</Label>
              <p className="font-medium text-foreground">
                {order.service_name || order.service_id} —{" "}
                {formatAmountFromCents(order.amount)}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Novo serviço</Label>
              <Select value={serviceId} onValueChange={setServiceId} disabled={loadingCatalog}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(catalogData?.catalog ?? []).map((section) => (
                    <SelectGroup key={section.section}>
                      <SelectLabel>{section.section}</SelectLabel>
                      {section.items.map((item) => (
                        <SelectItem key={item.code} value={item.code}>
                          {item.title} — {formatAmountFromCents(item.unit_price)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O valor será atualizado automaticamente conforme o catálogo.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            <XCircle className="mr-1 h-4 w-4" />
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mutation.isPending || !serviceId}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateFilter({
  label,
  value,
  placeholder,
  onSelect,
}: {
  label: string;
  value: Date | undefined;
  placeholder: string;
  onSelect: (date: Date | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-[170px] justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onSelect}
            initialFocus
            className={cn("pointer-events-auto p-3")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
