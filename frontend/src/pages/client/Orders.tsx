import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FileText, Filter, Search, Trash2 } from "lucide-react";
import { EditOrderDialog } from "@/components/client/EditOrderDialog";
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

import { api, type ClientOrder } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { toast } from "sonner";

const statusTone: Record<string, string> = {
  pendente: "bg-accent-soft text-primary",
  em_andamento: "bg-secondary text-foreground",
  concluido: "bg-emerald-100 text-emerald-900",
};

export default function Orders() {
  const queryClient = useQueryClient();
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["client-orders"],
    queryFn: () => api.clientArea.orders(),
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.clientArea.updateOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      toast.success("Pedido atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar pedido");
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id: number) => api.clientArea.cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      toast.success("Pedido cancelado. Créditos estornados quando aplicável.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Não foi possível cancelar este pedido.");
    },
  });

  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData?.orders]);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [pedidoParaCancelar, setPedidoParaCancelar] = useState<ClientOrder | null>(null);
  const [pedidoParaEditar, setPedidoParaEditar] = useState<ClientOrder | null>(null);

  const statusOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (!map.has(o.status)) map.set(o.status, o.status_label);
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

          <DateFilter
            label="Data inicial"
            value={dataInicio}
            placeholder="De"
            onSelect={setDataInicio}
          />
          <DateFilter
            label="Data final"
            value={dataFim}
            placeholder="Até"
            onSelect={setDataFim}
          />

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
              {pedidosFiltrados.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-secondary p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{order.service_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.reference}
                        {order.deadline_at
                          ? ` · Prazo: ${format(parseISO(order.deadline_at), "dd/MM/yyyy", { locale: ptBR })}`
                          : ""}
                        {" · "}
                        {format(parseISO(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        {" · "}
                        {order.total_brl}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
                        statusTone[order.status] ?? "bg-secondary text-foreground",
                      )}
                    >
                      {order.status_label}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPedidoParaEditar(order)}
                        aria-label={`Ver detalhes do pedido ${order.reference}`}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    {order.status === "pendente" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPedidoParaCancelar(order)}
                        aria-label={`Cancelar pedido ${order.reference}`}
                        disabled={cancelOrderMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <EditOrderDialog
        order={pedidoParaEditar}
        open={!!pedidoParaEditar}
        onOpenChange={(open) => !open && setPedidoParaEditar(null)}
        onSave={(data) => {
          if (pedidoParaEditar) {
            updateOrderMutation.mutate({ id: pedidoParaEditar.id, data });
            setPedidoParaEditar(null);
          }
        }}
        isSubmitting={updateOrderMutation.isPending}
      />

      <AlertDialog
        open={!!pedidoParaCancelar}
        onOpenChange={(open) => !open && setPedidoParaCancelar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido {pedidoParaCancelar?.reference} será cancelado e os créditos
              utilizados serão estornados automaticamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelOrderMutation.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pedidoParaCancelar) {
                  cancelOrderMutation.mutate(pedidoParaCancelar.id);
                  setPedidoParaCancelar(null);
                }
              }}
              disabled={cancelOrderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelOrderMutation.isPending ? "Cancelando..." : "Cancelar pedido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
