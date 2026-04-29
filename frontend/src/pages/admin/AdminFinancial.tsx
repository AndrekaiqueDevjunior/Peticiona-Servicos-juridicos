import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api, type AdminCreditPurchase, type FinancialEntry } from "@/lib/api";

const statusBadge: Record<string, string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-destructive/10 text-destructive border border-destructive/30",
  concluido: "bg-accent/15 text-accent border border-accent/30",
  cancelado: "bg-secondary text-muted-foreground border border-border",
};

const purchaseStatusBadge: Record<string, string> = {
  paid: "border-accent/30 bg-accent/15 text-accent",
  processing: "border-primary/20 bg-primary/10 text-primary",
  pending: "border-primary/20 bg-primary/10 text-primary",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  refunded: "border-border bg-secondary text-muted-foreground",
};

const purchaseStatusLabel: Record<string, string> = {
  paid: "Pago",
  processing: "Processando",
  pending: "Pendente",
  failed: "Falhou",
  refunded: "Estornado",
};

export default function AdminFinancial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [openEntryForm, setOpenEntryForm] = useState(false);
  const [entryForm, setEntryForm] = useState({
    description: "",
    kind: "credit",
    amount_cents: "0",
    occurred_at: "",
  });
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "financial"],
    queryFn: () => api.admin.financial(),
  });
  const { data: purchasesData, isLoading: isPurchasesLoading } = useQuery({
    queryKey: ["admin", "credit-purchases"],
    queryFn: () => api.admin.creditPurchases(),
  });
  const refundMutation = useMutation({
    mutationFn: (purchaseId: number) => api.admin.refundCreditPurchase(purchaseId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "credit-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "financial"] });
      toast({
        title: "Estorno total processado.",
        description: result.message,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Não foi possível estornar.",
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    },
  });
  const entryMutation = useMutation({
    mutationFn: () => {
      const payload = {
        description: entryForm.description.trim(),
        kind: entryForm.kind,
        amount_cents: Number(entryForm.amount_cents),
        occurred_at: entryForm.occurred_at || undefined,
      };
      if (editingEntry) return api.admin.updateFinancialEntry(editingEntry.id, payload);
      return api.admin.createFinancialEntry(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "financial"] });
      setOpenEntryForm(false);
      setEditingEntry(null);
      setEntryForm({ description: "", kind: "credit", amount_cents: "0", occurred_at: "" });
      toast({ title: editingEntry ? "Lançamento atualizado." : "Lançamento criado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar o lançamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => api.admin.deleteFinancialEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "financial"] });
      toast({ title: "Lançamento removido." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível remover o lançamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!editingEntry) {
      setEntryForm({ description: "", kind: "credit", amount_cents: "0", occurred_at: "" });
      return;
    }
    setEntryForm({
      description: editingEntry.description,
      kind: editingEntry.kind,
      amount_cents: String(editingEntry.amount_cents),
      occurred_at: editingEntry.occurred_at ? editingEntry.occurred_at.slice(0, 16) : "",
    });
  }, [editingEntry]);

  const stats = data?.stats;
  const orders = data?.orders ?? [];
  const entries = data?.entries ?? [];
  const purchases = purchasesData?.purchases ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral da receita e do volume de pedidos da plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Receita do mês"
          value={isLoading ? "Carregando..." : (stats?.receita_mes_brl ?? "R$ 0,00")}
          accent="primary"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Pedidos concluídos"
          value={String(stats?.concluidos ?? 0)}
          accent="accent"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pedidos em aberto"
          value={String(stats?.abertos ?? 0)}
          accent="destructive"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl">Lançamentos manuais</CardTitle>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => {
              setEditingEntry(null);
              setOpenEntryForm(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo lançamento
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando lançamentos...</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum lançamento manual registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {entry.kind === "credit" ? "Crédito" : "Débito"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.occurred_at_label}</TableCell>
                    <TableCell className="text-right font-medium">{entry.amount_brl}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar lançamento"
                          onClick={() => {
                            setEditingEntry(entry);
                            setOpenEntryForm(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover lançamento"
                          onClick={() => deleteEntryMutation.mutate(entry.id)}
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

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Compras de créditos Pagar.me</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isPurchasesLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando compras de crédito...</p>
          ) : purchases.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma compra de crédito registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Charge ID</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{purchase.code}</TableCell>
                    <TableCell>
                      <div className="max-w-[220px]">
                        <p className="truncate text-sm font-medium">{purchase.user_name ?? "Cliente"}</p>
                        <p className="truncate text-xs text-muted-foreground">{purchase.user_email ?? "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{purchase.package_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "whitespace-nowrap",
                          purchaseStatusBadge[purchase.status] ?? "border-border bg-secondary text-foreground",
                        )}
                      >
                        {purchaseStatusLabel[purchase.status] ?? purchase.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(purchase.created_at)}
                    </TableCell>
                    <TableCell className="max-w-[170px] truncate font-mono text-xs text-muted-foreground">
                      {purchase.pagarme_charge_id ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{purchase.amount_brl}</TableCell>
                    <TableCell className="text-right">
                      <RefundPurchaseDialog
                        purchase={purchase}
                        isPending={refundMutation.isPending && refundMutation.variables === purchase.id}
                        onConfirm={() => refundMutation.mutate(purchase.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Pedidos do período</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando dados financeiros...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Split %</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">Nº {p.numero}</TableCell>
                    <TableCell>{p.cliente}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.funcionario ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                          statusBadge[p.status] ?? "bg-secondary text-foreground border border-border",
                        )}
                      >
                        {p.status_label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.criado_em}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {p.split_plataforma}/{p.split_funcionario}
                    </TableCell>
                    <TableCell className="text-right font-medium">{p.valor_brl}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableCell colSpan={6} className="text-right font-semibold">
                    Subtotal
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {stats?.receita_mes_brl ?? "R$ 0,00"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Filtros por mês, funcionário e status estarão disponíveis em uma próxima atualização.
      </p>

      <Dialog open={openEntryForm} onOpenChange={setOpenEntryForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!entryForm.description.trim()) {
                toast({ title: "Descrição obrigatória", variant: "destructive" });
                return;
              }
              entryMutation.mutate();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="entry-description">Descrição</Label>
              <Input
                id="entry-description"
                value={entryForm.description}
                onChange={(event) => setEntryForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={entryForm.kind}
                  onValueChange={(value) => setEntryForm((current) => ({ ...current, kind: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="entry-amount">Valor (centavos)</Label>
                <Input
                  id="entry-amount"
                  type="number"
                  value={entryForm.amount_cents}
                  onChange={(event) => setEntryForm((current) => ({ ...current, amount_cents: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="entry-date">Data</Label>
                <Input
                  id="entry-date"
                  type="datetime-local"
                  value={entryForm.occurred_at}
                  onChange={(event) => setEntryForm((current) => ({ ...current, occurred_at: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenEntryForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={entryMutation.isPending}>
                {entryMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RefundPurchaseDialog({
  purchase,
  isPending,
  onConfirm,
}: {
  purchase: AdminCreditPurchase;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const canRefund = ["paid", "processing"].includes(purchase.status) && Boolean(purchase.pagarme_charge_id);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!canRefund || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Estornar total
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar estorno total</AlertDialogTitle>
          <AlertDialogDescription>
            A cobrança {purchase.pagarme_charge_id} será cancelada na Pagar.me pelo valor total de{" "}
            {purchase.amount_brl}. Os créditos lançados para {purchase.user_name ?? "o cliente"} serão revertidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Estornar total
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "primary" | "accent" | "destructive";
}) {
  const tone = {
    primary: "text-primary bg-primary/10 border-primary/20",
    accent: "text-accent bg-accent/15 border-accent/30",
    destructive: "text-destructive bg-destructive/10 border-destructive/30",
  }[accent];

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border",
            tone,
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 font-display text-xl font-semibold text-foreground">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("pt-BR");
}
