import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, RefreshCw, ShoppingBag, Undo2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "@/hooks/use-toast";
import { api, type AdminCreditPurchase, type AdminOrder } from "@/lib/api";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
};

const statusBadge: Record<string, string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-secondary text-foreground border border-border",
  concluido: "bg-accent/15 text-accent border border-accent/30",
  cancelado: "bg-destructive/10 text-destructive border border-destructive/30",
};

const purchaseStatusBadge: Record<string, string> = {
  paid: "bg-accent/15 text-accent border border-accent/30",
  processing: "bg-primary/10 text-primary border border-primary/20",
  pending: "bg-secondary text-foreground border border-border",
  refunded: "bg-destructive/10 text-destructive border border-destructive/30",
  failed: "bg-destructive/10 text-destructive border border-destructive/30",
};

export default function AdminFinancial() {
  const queryClient = useQueryClient();
  const hoje = new Date();
  const [mes, setMes] = useState<number>(hoje.getMonth());
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [funcionarioFiltro, setFuncionarioFiltro] = useState<string>("todos");
  const [refundTarget, setRefundTarget] = useState<AdminCreditPurchase | null>(null);
  const [showRecoverConfirm, setShowRecoverConfirm] = useState(false);

  const { data: summary, isLoading: loadingSummary, error: summaryError } = useQuery({
    queryKey: ["admin-financial"],
    queryFn: () => api.admin.financial.summary(),
  });

  const { data: purchasesData, isLoading: loadingPurchases, error: purchasesError } = useQuery({
    queryKey: ["admin-credit-purchases"],
    queryFn: () => api.admin.financial.creditPurchases(),
  });

  const orders: AdminOrder[] = summary?.orders ?? [];
  const purchases: AdminCreditPurchase[] = purchasesData?.purchases ?? [];

  const refundMutation = useMutation({
    mutationFn: (purchase: AdminCreditPurchase) =>
      purchase.source_kind === "checkout_order"
        ? api.admin.financial.refundCheckoutOrder(purchase.id)
        : api.admin.financial.refundPurchase(purchase.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["admin-financial"] });
      toast({ title: "Estorno solicitado à Pagar.me com sucesso." });
      setRefundTarget(null);
    },
    onError: (err) => {
      toast({
        title: "Não foi possível estornar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const recoverAllMutation = useMutation({
    mutationFn: () => api.admin.financial.recoverAllPendingCredits(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-purchases"] });
      toast({
        title:
          data.recovered > 0
            ? `${data.recovered} pedido(s) recuperado(s)`
            : "Nenhum crédito pendente encontrado",
        description: data.message,
      });
      setShowRecoverConfirm(false);
    },
    onError: (err) => {
      toast({
        title: "Não foi possível recuperar créditos",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
      setShowRecoverConfirm(false);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (purchase: AdminCreditPurchase) =>
      api.admin.financial.releaseCheckoutOrderCredits(purchase.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-purchases"] });
      toast({
        title: data.already_done ? "Créditos já liberados" : "Créditos liberados",
        description: data.message,
      });
    },
    onError: (err) => {
      toast({
        title: "Não foi possível liberar créditos",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([hoje.getFullYear()]);
    purchases.forEach((p) => set.add(new Date(p.created_at).getFullYear()));
    orders.forEach((p) => {
      if (p.criado_em_iso) set.add(new Date(p.criado_em_iso).getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [hoje, purchases, orders]);

  const funcionarios = useMemo(() => {
    const map = new Map<number, string>();
    orders.forEach((o) => {
      if (o.staff_user_id && o.funcionario) map.set(o.staff_user_id, o.funcionario);
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id: String(id), nome }));
  }, [orders]);

  const comprasFiltradas = useMemo(
    () =>
      purchases.filter((p) => {
        const d = new Date(p.created_at);
        return d.getMonth() === mes && d.getFullYear() === ano;
      }),
    [purchases, mes, ano],
  );

  const pedidosFiltrados = useMemo(
    () =>
      orders.filter((o) => {
        if (!o.criado_em_iso) return false;
        const d = new Date(o.criado_em_iso);
        if (d.getMonth() !== mes || d.getFullYear() !== ano) return false;
        if (funcionarioFiltro === "todos") return true;
        if (funcionarioFiltro === "sem_vinculo") return !o.staff_user_id;
        return String(o.staff_user_id) === funcionarioFiltro;
      }),
    [orders, mes, ano, funcionarioFiltro],
  );

  const stats = useMemo(() => {
    const receitaMes = comprasFiltradas
      .filter((c) => c.status === "paid")
      .reduce((s, c) => s + c.amount_cents, 0);
    const totalCompras = comprasFiltradas.length;
    const concluidos = pedidosFiltrados.filter((p) => p.status === "concluido").length;
    const totalPagarFuncionario = pedidosFiltrados.reduce(
      (s, p) => s + (p.valor * (p.split_funcionario ?? 0)) / 100,
      0,
    );
    return { receitaMes, totalCompras, concluidos, totalPagarFuncionario };
  }, [comprasFiltradas, pedidosFiltrados]);

  const filtroFuncionarioLabel =
    funcionarioFiltro === "todos"
      ? "todos os funcionários"
      : funcionarioFiltro === "sem_vinculo"
        ? "pedidos sem vínculo"
        : funcionarios.find((f) => f.id === funcionarioFiltro)?.nome ?? "—";

  const loadError =
    summaryError instanceof Error
      ? summaryError.message
      : purchasesError instanceof Error
        ? purchasesError.message
        : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Financeiro
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receita do mês a partir das compras de saldo (planos e avulsos) feitas pelos clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((nome, i) => (
                <SelectItem key={i} value={String(i)}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Receita do mês"
          value={formatBRL(stats.receitaMes)}
          accent="primary"
        />
        <StatCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Compras de saldo"
          value={String(stats.totalCompras)}
          accent="accent"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Pedidos concluídos"
          value={String(stats.concluidos)}
          accent="destructive"
        />
      </div>

      <Tabs defaultValue="compras">
        <TabsList>
          <TabsTrigger value="compras">Compras de saldo</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="compras" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-xl">
                Compras de {MESES[mes]} / {ano}
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowRecoverConfirm(true)}
                disabled={recoverAllMutation.isPending}
                className="gap-1.5 text-accent border-accent/40 hover:bg-accent/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Recuperar créditos pendentes
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPurchases ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Carregando compras...
                      </TableCell>
                    </TableRow>
                  ) : comprasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma compra registrada neste período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comprasFiltradas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.user_name ?? c.user_email ?? "—"}</TableCell>
                        <TableCell className="font-medium">{c.package_name}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                              purchaseStatusBadge[c.status] ??
                                "bg-secondary text-foreground border border-border",
                            )}
                          >
                            {c.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(c.created_at)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{c.amount_brl}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {c.status === "paid" && !c.credited_at && c.source_kind === "checkout_order" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => releaseMutation.mutate(c)}
                                disabled={releaseMutation.isPending}
                                className="gap-1 text-accent hover:bg-accent/10"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Liberar créditos
                              </Button>
                            )}
                            {c.status === "paid" && c.pagarme_charge_id && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setRefundTarget(c)}
                                className="gap-1 text-destructive hover:bg-destructive/10"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                                Estornar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {comprasFiltradas.length > 0 && (
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableCell colSpan={4} className="text-right font-semibold">
                        Receita do mês (compras pagas)
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatBRL(stats.receitaMes)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedidos" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={funcionarioFiltro} onValueChange={setFuncionarioFiltro}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Filtrar por funcionário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os funcionários</SelectItem>
                  <SelectItem value="sem_vinculo">Sem vínculo</SelectItem>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {funcionarioFiltro !== "todos" && (
              <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  A pagar a {filtroFuncionarioLabel} em {MESES[mes]}/{ano}:{" "}
                </span>
                <span className="font-semibold text-accent">
                  {formatBRL(stats.totalPagarFuncionario)}
                </span>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">
                Pedidos de {MESES[mes]} / {ano}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-center">Split % (Plat. / Func.)</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Repasse func.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSummary ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Carregando pedidos...
                      </TableCell>
                    </TableRow>
                  ) : pedidosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum pedido neste período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pedidosFiltrados.map((p) => (
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
                              statusBadge[p.status] ??
                                "bg-secondary text-foreground border border-border",
                            )}
                          >
                            {p.status_label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.criado_em_iso ? formatDateTime(p.criado_em_iso) : p.criado_em}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {p.split_plataforma ?? 100} / {p.split_funcionario ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {p.valor_brl}
                        </TableCell>
                        <TableCell className="text-right font-medium text-accent">
                          {formatBRL((p.valor * (p.split_funcionario ?? 0)) / 100)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {pedidosFiltrados.length > 0 && (
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableCell colSpan={7} className="text-right font-semibold">
                        Total a pagar a {filtroFuncionarioLabel}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-accent">
                        {formatBRL(stats.totalPagarFuncionario)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Os valores de pedidos refletem o consumo de saldo já adquirido — a receita do mês é
            contabilizada no momento da compra de saldo (planos ou avulsos). Edição de split por
            pedido em <span className="font-medium">Pedidos &rarr; detalhes do pedido</span>.
          </p>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={showRecoverConfirm}
        onOpenChange={(open) => !open && setShowRecoverConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recuperar créditos pendentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação varre <span className="font-semibold">todos os pedidos pagos</span> no
              sistema e libera créditos para aqueles que foram confirmados pela Pagar.me mas ainda
              não foram creditados (ex: falha de webhook). A operação é segura e idempotente — não
              duplica créditos já liberados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={recoverAllMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => recoverAllMutation.mutate()}
              disabled={recoverAllMutation.isPending}
            >
              {recoverAllMutation.isPending ? "Recuperando..." : "Recuperar agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && setRefundTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar esta compra?</AlertDialogTitle>
            <AlertDialogDescription>
              A compra <span className="font-semibold">{refundTarget?.package_name}</span> de{" "}
              <span className="font-semibold">
                {refundTarget?.user_name ?? refundTarget?.user_email}
              </span>{" "}
              será cancelada via Pagar.me e os créditos do cliente revertidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refundMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => refundTarget && refundMutation.mutate(refundTarget)}
              disabled={refundMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {refundMutation.isPending ? "Estornando..." : "Confirmar estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
