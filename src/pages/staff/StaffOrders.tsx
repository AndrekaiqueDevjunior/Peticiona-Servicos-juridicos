import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, FileText, Inbox } from "lucide-react";

import { api, type ClientOrder } from "@/lib/api";
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

const badgeColor: Record<string, string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-accent/15 text-accent border border-accent/30",
  concluido: "bg-secondary text-foreground border border-border",
};

export default function StaffOrders() {
  const { data, isLoading } = useQuery({
    queryKey: ["staff", "orders"],
    queryFn: () => api.staff.orders(),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const orders = data?.orders ?? [];
  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Bandeja de pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedidos reais atribuídos ao funcionário autenticado.
          </p>
        </div>
        <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} na bandeja
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Fila de serviços</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando pedidos...</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">Nenhum pedido na bandeja ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-secondary p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {order.reference} · {order.service_type}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Prazo do cliente:{" "}
                        {order.deadline_at
                          ? format(parseISO(order.deadline_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeColor[order.status] ?? "bg-secondary text-foreground border border-border"}`}>
                      {order.status_label}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedId(order.id)}>
                      Abrir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <StaffOrderDialog order={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function StaffOrderDialog({ order, onClose }: { order: ClientOrder | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (status: string) => api.staff.updateOrder(order!.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Status atualizado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível atualizar o pedido",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!order) return null;

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{order.reference}</DialogTitle>
          <DialogDescription>{order.service_type}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid gap-2">
            <Label>Status do pedido</Label>
            <Select value={order.status} onValueChange={(value) => updateMutation.mutate(value)}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="Cliente" value={order.client_name ?? "—"} />
            <Info label="Valor" value={order.total_brl} />
            <Info
              label="Criado em"
              value={
                order.created_at
                  ? format(parseISO(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : "—"
              }
            />
            <Info
              label="Prazo do cliente"
              value={
                order.deadline_at
                  ? format(parseISO(order.deadline_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : "—"
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
