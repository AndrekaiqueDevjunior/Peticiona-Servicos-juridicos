import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, ShoppingBag, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  ADMIN_COMPRAS,
  ADMIN_FUNCIONARIOS,
  type AdminPedidoMock,
  type AdminCompraMock,
} from "@/lib/adminMocks";
import { useAdminPedidos, atualizarSplit, ADMIN_RESPONSAVEL_ID } from "@/lib/adminPedidos";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusBadge: Record<AdminPedidoMock["status"], string> = {
  "Em análise": "bg-primary/10 text-primary border border-primary/20",
  "Aguardando dados": "bg-destructive/10 text-destructive border border-destructive/30",
  Concluído: "bg-accent/15 text-accent border border-accent/30",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Pedidos usam "dd/MM/yyyy HH:mm"; compras usam ISO.
const parsePedidoDate = (s: string): Date => {
  const [data, hora = "00:00"] = s.split(" ");
  const [dd, mm, yyyy] = data.split("/").map(Number);
  const [hh, mi] = hora.split(":").map(Number);
  return new Date(yyyy, (mm ?? 1) - 1, dd ?? 1, hh ?? 0, mi ?? 0);
};

const formatCompraData = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const tipoBadge: Record<AdminCompraMock["tipo"], string> = {
  plano: "bg-primary/10 text-primary border border-primary/20",
  avulso: "bg-accent/15 text-accent border border-accent/30",
};

export default function AdminFinancial() {
  const hoje = new Date();
  const [mes, setMes] = useState<number>(hoje.getMonth());
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [funcionarioFiltro, setFuncionarioFiltro] = useState<string>("todos");

  const pedidosStore = useAdminPedidos();

  // Anos disponíveis: dos dados + ano corrente.
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([hoje.getFullYear()]);
    ADMIN_COMPRAS.forEach((c) => set.add(new Date(c.dataISO).getFullYear()));
    pedidosStore.forEach((p) => set.add(parsePedidoDate(p.criadoEm).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [hoje, pedidosStore]);

  const comprasFiltradas = useMemo(
    () =>
      ADMIN_COMPRAS.filter((c) => {
        const d = new Date(c.dataISO);
        return d.getMonth() === mes && d.getFullYear() === ano;
      }),
    [mes, ano],
  );

  const pedidosFiltrados = useMemo(
    () =>
      pedidosStore.filter((p) => {
        const d = parsePedidoDate(p.criadoEm);
        if (d.getMonth() !== mes || d.getFullYear() !== ano) return false;
        if (funcionarioFiltro === "todos") return true;
        if (funcionarioFiltro === "sem_vinculo") return !p.funcionarioId;
        return p.funcionarioId === funcionarioFiltro;
      }),
    [pedidosStore, mes, ano, funcionarioFiltro],
  );

  const stats = useMemo(() => {
    const receitaMes = comprasFiltradas.reduce((s, c) => s + c.valor, 0);
    const totalCompras = comprasFiltradas.length;
    const concluidos = pedidosFiltrados.filter((p) => p.status === "Concluído").length;
    const totalPagarFuncionario = pedidosFiltrados.reduce(
      (s, p) => s + (p.valor * p.splitFuncionario) / 100,
      0,
    );
    return { receitaMes, totalCompras, concluidos, totalPagarFuncionario };
  }, [comprasFiltradas, pedidosFiltrados]);

  const filtroFuncionarioLabel =
    funcionarioFiltro === "todos"
      ? "todos os funcionários"
      : funcionarioFiltro === "sem_vinculo"
        ? "pedidos sem vínculo"
        : funcionarioFiltro === ADMIN_RESPONSAVEL_ID
          ? "Admin Peticiona"
          : ADMIN_FUNCIONARIOS.find((f) => f.id === funcionarioFiltro)?.nome ?? "—";

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
            <CardHeader>
              <CardTitle className="font-display text-xl">
                Compras de {MESES[mes]} / {ano}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma compra registrada neste período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comprasFiltradas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.cliente}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                              tipoBadge[c.tipo],
                            )}
                          >
                            {c.tipo === "plano" ? "Plano" : "Avulso"}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{c.produto}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatCompraData(c.dataISO)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBRL(c.valor)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {comprasFiltradas.length > 0 && (
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableCell colSpan={4} className="text-right font-semibold">
                        Receita do mês
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatBRL(stats.receitaMes)}
                      </TableCell>
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
                  <SelectItem value={ADMIN_RESPONSAVEL_ID}>Admin Peticiona</SelectItem>
                  {ADMIN_FUNCIONARIOS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {funcionarioFiltro !== "todos" && (
              <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
                <span className="text-muted-foreground">A pagar a {filtroFuncionarioLabel} em {MESES[mes]}/{ano}: </span>
                <span className="font-semibold text-accent">{formatBRL(stats.totalPagarFuncionario)}</span>
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
                  {pedidosFiltrados.length === 0 ? (
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
                              statusBadge[p.status],
                            )}
                          >
                            {p.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.criadoEm}
                        </TableCell>
                        <TableCell>
                          <SplitEditor pedido={p} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBRL(p.valor)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-accent">
                          {formatBRL((p.valor * p.splitFuncionario) / 100)}
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
            contabilizada no momento da compra de saldo (planos ou avulsos).
          </p>
        </TabsContent>
      </Tabs>
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

function SplitEditor({ pedido }: { pedido: AdminPedidoMock }) {
  const [plat, setPlat] = useState<string>(String(pedido.splitPlataforma));
  const [editing, setEditing] = useState(false);

  const commit = () => {
    setEditing(false);
    const n = Number(plat);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      setPlat(String(pedido.splitPlataforma));
      return;
    }
    const sp = Math.round(n);
    atualizarSplit(pedido.id, sp, 100 - sp);
    setPlat(String(sp));
  };

  return (
    <div className="flex items-center justify-center gap-1 text-xs">
      <Input
        type="number"
        min={0}
        max={100}
        value={editing ? plat : String(pedido.splitPlataforma)}
        onChange={(e) => {
          setEditing(true);
          setPlat(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setPlat(String(pedido.splitPlataforma));
            setEditing(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-8 w-14 text-center text-xs"
        aria-label="Split plataforma %"
      />
      <span className="text-muted-foreground">/</span>
      <span className="w-10 text-center font-medium text-foreground">
        {100 - (Number(editing ? plat : pedido.splitPlataforma) || 0)}
      </span>
      <span className="text-muted-foreground">%</span>
    </div>
  );
}
