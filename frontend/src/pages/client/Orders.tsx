import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Trash2, UserRound } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const badgeColor: Record<string, string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-accent/15 text-accent border border-accent/30",
  concluido: "bg-secondary text-foreground border border-border",
  cancelado: "bg-destructive/10 text-destructive border border-destructive/20",
};

export default function Orders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["client-orders"],
    queryFn: () => api.clientArea.orders(),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deadlineValue, setDeadlineValue] = useState("");

  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId],
  );

  useEffect(() => {
    setDeadlineValue(toDateTimeLocal(selected?.deadline_at ?? null));
  }, [selected?.deadline_at, selected?.id]);

  const updateMutation = useMutation({
    mutationFn: (payload: { orderId: number; deadline_at: string | null }) =>
      api.clientArea.updateOrder(payload.orderId, { deadline_at: payload.deadline_at }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Pedido atualizado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível atualizar o pedido",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => api.clientArea.deleteOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedId(null);
      toast({ title: "Pedido cancelado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível cancelar o pedido",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canCancel = (status: string) => !["concluido", "cancelado"].includes(status);
  const canEdit = (status: string) => status === "pendente";
  const saveDeadline = () => {
    if (!selected) return;
    updateMutation.mutate({
      orderId: selected.id,
      deadline_at: deadlineValue ? new Date(deadlineValue).toISOString() : null,
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meus pedidos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fluxo real do cliente conectado ao backend de ServiceOrder.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando pedidos...</p>
          ) : orders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido ainda. Use o botão "Novo pedido" para começar.
            </p>
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
                      <p className="font-medium text-foreground">{order.service_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.reference} ·{" "}
                        {order.created_at
                          ? format(parseISO(order.created_at), "dd/MM/yyyy", { locale: ptBR })
                          : "Sem data"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${badgeColor[order.status] ?? "bg-secondary text-foreground border border-border"}`}
                    >
                      {order.status_label}
                    </span>
                    <span className="text-sm font-medium text-primary">{order.total_brl}</span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedId(order.id)}>
                      Ver detalhes
                    </Button>
                    {canCancel(order.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(order.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.reference}</DialogTitle>
                <DialogDescription>{selected.service_type}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Status" value={selected.status_label} />
                <Info label="Valor" value={selected.total_brl} />
                <Info
                  label="Criado em"
                  value={
                    selected.created_at
                      ? format(parseISO(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"
                  }
                />
                <Info
                  label="Prazo"
                  value={
                    selected.deadline_at
                      ? format(parseISO(selected.deadline_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"
                  }
                />
                <Info
                  label="Responsável"
                  value={selected.staff_name ?? "Aguardando atribuição"}
                  icon={<UserRound className="h-4 w-4 text-muted-foreground" />}
                />
                <Info
                  label="Concluído em"
                  value={
                    selected.completed_at
                      ? format(parseISO(selected.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"
                  }
                />
              </div>
              {canEdit(selected.status) && (
                <div className="grid gap-3 rounded-md border border-border bg-secondary/20 p-4">
                  <Label htmlFor="order-deadline">Prazo do cliente</Label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="order-deadline"
                      type="datetime-local"
                      value={deadlineValue}
                      onChange={(event) => setDeadlineValue(event.target.value)}
                    />
                    <Button
                      type="button"
                      disabled={updateMutation.isPending}
                      onClick={saveDeadline}
                    >
                      {updateMutation.isPending ? "Salvando..." : "Salvar prazo"}
                    </Button>
                  </div>
                </div>
              )}
              {canCancel(selected.status) && (
                <div className="flex justify-end border-t border-border pt-4">
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(selected.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {cancelMutation.isPending ? "Cancelando..." : "Cancelar pedido"}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
