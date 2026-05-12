import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FileText, Filter, Paperclip, Search, UserRound } from "lucide-react";

import { api, type ClientOrder, type Petition } from "@/lib/api";
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

const statusTone: Record<string, string> = {
  pendente: "bg-accent-soft text-primary",
  em_andamento: "bg-secondary text-foreground",
  concluido: "bg-emerald-100 text-emerald-900",
};

export default function Orders() {
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["client-orders"],
    queryFn: () => api.clientArea.orders(),
  });

  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData?.orders]);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [pedidoSelecionado, setPedidoSelecionado] = useState<ClientOrder | null>(null);

  // Mantém compatibilidade com o dialog de petições
  const petitionSelecionada = pedidoSelecionado?.petition ?? null;
  const setPetitionSelecionada = (p: Petition | null) => {
    if (!p) setPedidoSelecionado(null);
  };

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
                    {order.petition && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPedidoSelecionado(order)}
                        aria-label={`Ver detalhes do pedido ${order.numero}`}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PetitionDetailsDialog
        petition={petitionSelecionada}
        onClose={() => setPetitionSelecionada(null)}
      />
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

function PetitionDetailsDialog({
  petition,
  onClose,
}: {
  petition: Petition | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!petition} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {!petition ? null : (
          <>
            <DialogHeader>
              <DialogTitle>{petition.reference}</DialogTitle>
              <DialogDescription>
                {petition.tipo_peticao || "Petição"} · {petition.status_label}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6">
              <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
                <Info label="Área do Direito" value={petition.area_direito} />
                <Info label="Tipo de petição" value={petition.tipo_peticao || "—"} />
                <Info label="Número do processo" value={petition.numero_processo || "—"} />
                <Info
                  label="Data de publicação"
                  value={
                    petition.data_publicacao
                      ? format(parseISO(petition.data_publicacao), "dd/MM/yyyy", { locale: ptBR })
                      : "—"
                  }
                />
                <Info
                  label="Justiça gratuita"
                  value={petition.justica_gratuita ? "Sim" : "Não"}
                />
                <Info
                  label="Tutela de urgência"
                  value={petition.tutela_urgencia ? "Sim" : "Não"}
                />
                <Info
                  label="Advogado subscritor"
                  value={petition.advogado_subscritor || "—"}
                  className="sm:col-span-2"
                />
              </section>

              <section className="grid gap-3 rounded-lg border border-border p-4">
                <h3 className="font-medium text-foreground">Resumo do caso</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {petition.resumo_caso || "Sem resumo informado."}
                </p>
              </section>

              <section className="grid gap-3 rounded-lg border border-border p-4">
                <h3 className="font-medium text-foreground">Detalhes adicionais</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {petition.detalhes || "Sem detalhes adicionais."}
                </p>
              </section>

              <section className="grid gap-3 rounded-lg border border-border p-4">
                <h3 className="font-medium text-foreground">Partes</h3>
                {!petition.partes.length ? (
                  <p className="text-sm text-muted-foreground">Nenhuma parte cadastrada.</p>
                ) : (
                  <ul className="grid gap-2">
                    {petition.partes.map((parte, index) => (
                      <li
                        key={`${parte.nome}-${index}`}
                        className="flex items-center gap-3 rounded-md bg-secondary/50 px-3 py-2"
                      >
                        <UserRound className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{parte.nome}</p>
                          <p className="text-xs text-muted-foreground">{parte.tipo}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="grid gap-3 rounded-lg border border-border p-4">
                <h3 className="font-medium text-foreground">Documentos enviados</h3>
                {!petition.documents.length ? (
                  <p className="text-sm text-muted-foreground">Nenhum documento vinculado.</p>
                ) : (
                  <ul className="grid gap-2">
                    {petition.documents.map((document) => (
                      <li
                        key={document.id}
                        className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {document.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {document.size_label} ·{" "}
                              {format(parseISO(document.created_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
