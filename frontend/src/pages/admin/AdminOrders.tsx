import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { api, type AdminOrder } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const statusBadge: Record<string, string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-destructive/10 text-destructive border border-destructive/30",
  concluido: "bg-accent/15 text-accent border border-accent/30",
};

interface OrderFormState {
  user_id: string;
  tipo_servico: string;
  status: string;
  valor: string;
  prazo_cliente: string;
  finalizado_em: string;
  staff_user_id: string;
  split_plataforma: string;
  split_funcionario: string;
}

const emptyForm: OrderFormState = {
  user_id: "",
  tipo_servico: "",
  status: "pendente",
  valor: "0",
  prazo_cliente: "",
  finalizado_em: "",
  staff_user_id: "",
  split_plataforma: "100",
  split_funcionario: "0",
};

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => api.admin.orders(),
  });
  const { data: clientsData } = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: () => api.admin.clients(),
  });
  const { data: staffData } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api.admin.staff(),
  });
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [editing, setEditing] = useState<AdminOrder | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<OrderFormState>(emptyForm);

  const orders = data?.orders ?? [];
  const clients = clientsData?.clients ?? [];
  const staff = staffData?.staff ?? [];

  useEffect(() => {
    if (!editing) {
      setForm(emptyForm);
      return;
    }
    setForm({
      user_id: editing.user_id != null ? String(editing.user_id) : "",
      tipo_servico: editing.tipo_servico,
      status: editing.status,
      valor: String(editing.valor),
      prazo_cliente: editing.prazo_cliente_iso ?? "",
      finalizado_em: editing.finalizado_em_iso ?? "",
      staff_user_id: editing.staff_user_id != null ? String(editing.staff_user_id) : "",
      split_plataforma: String(editing.split_plataforma),
      split_funcionario: String(editing.split_funcionario),
    });
  }, [editing]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: Number(form.user_id),
        tipo_servico: form.tipo_servico.trim(),
        status: form.status,
        valor: Number(form.valor),
        prazo_cliente: form.prazo_cliente.trim() || undefined,
        finalizado_em: form.finalizado_em.trim() || undefined,
        staff_user_id: form.staff_user_id ? Number(form.staff_user_id) : null,
        split_plataforma: Number(form.split_plataforma),
        split_funcionario: Number(form.split_funcionario),
      };
      if (editing) return api.admin.updateOrder(editing.id, payload);
      return api.admin.createOrder(payload);
    },
    onSuccess: () => {
      invalidate();
      setOpenForm(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Pedido atualizado." : "Pedido criado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar o pedido",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (orderId: number) => api.admin.deleteOrder(orderId),
    onSuccess: () => {
      invalidate();
      setSelected(null);
      toast({ title: "Pedido removido." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível remover o pedido",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.user_id || !form.tipo_servico.trim()) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Cliente e tipo de serviço são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Todos os pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRUD administrativo real do domínio principal atual.
          </p>
        </div>
        <Button
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => {
            setEditing(null);
            setOpenForm(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo pedido
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Pedidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando pedidos...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo de serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Prazo cliente</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">Nº {order.numero}</TableCell>
                    <TableCell>{order.cliente}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{order.tipo_servico}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                          statusBadge[order.status] ?? "bg-secondary text-foreground border border-border",
                        )}
                      >
                        {order.status_label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{order.funcionario ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{order.prazo_cliente}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ver detalhes do pedido ${order.numero}`}
                          onClick={() => setSelected(order)}
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar pedido ${order.numero}`}
                          onClick={() => {
                            setEditing(order);
                            setOpenForm(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover pedido ${order.numero}`}
                          onClick={() => deleteMutation.mutate(order.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar pedido" : "Novo pedido"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Cliente</Label>
                <Select value={form.user_id} onValueChange={(value) => setForm((current) => ({ ...current, user_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Funcionário</Label>
                <Select
                  value={form.staff_user_id || "none"}
                  onValueChange={(value) => setForm((current) => ({ ...current, staff_user_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem vínculo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {staff.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Field
              id="order-service"
              label="Tipo de serviço"
              value={form.tipo_servico}
              onChange={(value) => setForm((current) => ({ ...current, tipo_servico: value }))}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field
                id="order-value"
                label="Valor (centavos)"
                type="number"
                value={form.valor}
                onChange={(value) => setForm((current) => ({ ...current, valor: value }))}
              />
              <Field
                id="order-deadline"
                label="Prazo cliente"
                value={form.prazo_cliente}
                onChange={(value) => setForm((current) => ({ ...current, prazo_cliente: value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                id="order-completed"
                label="Finalizado em"
                value={form.finalizado_em}
                onChange={(value) => setForm((current) => ({ ...current, finalizado_em: value }))}
              />
              <Field
                id="order-split-platform"
                label="Split plataforma"
                type="number"
                value={form.split_plataforma}
                onChange={(value) => setForm((current) => ({ ...current, split_plataforma: value }))}
              />
              <Field
                id="order-split-staff"
                label="Split funcionário"
                type="number"
                value={form.split_funcionario}
                onChange={(value) => setForm((current) => ({ ...current, split_funcionario: value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-3">
                  Pedido Nº {selected.numero}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                      statusBadge[selected.status],
                    )}
                  >
                    {selected.status}
                  </span>
                </DialogTitle>
                <DialogDescription>Persistido em banco via `/api/admin/orders`.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Cliente" value={selected.cliente} />
                <Detail label="Funcionário" value={selected.funcionario ?? "—"} />
                <Detail label="Tipo de serviço" value={selected.tipo_servico} className="sm:col-span-2" />
                <Detail label="Criado em" value={selected.criado_em} />
                <Detail label="Prazo cliente" value={selected.prazo_cliente} />
                <Detail label="Finalizado em" value={selected.finalizado_em} />
                <Detail label="Valor" value={selected.valor_brl} />
                <Detail label="Split plataforma" value={`${selected.split_plataforma}%`} />
                <Detail label="Split funcionário" value={`${selected.split_funcionario}%`} />
              </div>
              {selected.petition && (
                <div className="space-y-4 border-t border-border pt-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Detalhes do formulário</h3>
                    <p className="text-xs text-muted-foreground">Petição {selected.petition.reference}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Área do Direito" value={selected.petition.area_direito} />
                    <Detail label="Tipo de petição" value={selected.petition.tipo_peticao ?? "—"} />
                    <Detail label="Número do processo" value={selected.petition.numero_processo ?? "—"} />
                    <Detail label="Data de publicação" value={selected.petition.data_publicacao ?? "—"} />
                    <Detail label="Justiça gratuita" value={selected.petition.justica_gratuita ? "Sim" : "Não"} />
                    <Detail label="Tutela de urgência" value={selected.petition.tutela_urgencia ? "Sim" : "Não"} />
                    <Detail
                      label="Advogado subscritor"
                      value={selected.petition.advogado_subscritor ?? "—"}
                      className="sm:col-span-2"
                    />
                    <Detail label="Resumo do caso" value={selected.petition.resumo_caso ?? "—"} className="sm:col-span-2" />
                    <Detail label="Detalhes" value={selected.petition.detalhes ?? "—"} className="sm:col-span-2" />
                  </div>
                  {selected.petition.partes && selected.petition.partes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Partes</p>
                      <div className="divide-y divide-border rounded-md border border-border">
                        {selected.petition.partes.map((parte, index) => (
                          <div key={`${parte.nome}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span className="font-medium text-foreground">{parte.nome}</span>
                            <span className="text-muted-foreground">{parte.tipo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selected.petition.documents && selected.petition.documents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Documentos</p>
                      <div className="divide-y divide-border rounded-md border border-border">
                        {selected.petition.documents.map((document) => (
                          <div key={document.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span className="font-medium text-foreground">{document.file_name}</span>
                            <span className="text-muted-foreground">{document.size_label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border bg-card p-3", className)}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
