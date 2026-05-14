import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FileText, Filter } from "lucide-react";

import { api, type ClientOrder } from "@/lib/api";
import type { CheckoutOrderType } from "@/lib/api";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/checkoutApi";
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

export default function Orders() {
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["client-checkout-orders"],
    queryFn: () => api.clientArea.checkoutOrders(),
  });

  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData?.orders]);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

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
                      <p className="font-medium text-foreground">{order.service_name || order.service_id}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {order.id}
                        {" · "}
                        {format(parseISO(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        {" · "}
                        {(order.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
                        STATUS_TONE[order.status] ? `bg-${STATUS_TONE[order.status] === "success" ? "emerald-100 text-emerald-900" : STATUS_TONE[order.status] === "warning" ? "bg-yellow-100 text-yellow-900" : "bg-gray-100 text-gray-900"}` : "bg-secondary text-foreground",
                      )}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
