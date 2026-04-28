import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

const statusBadge: Record<string, string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-destructive/10 text-destructive border border-destructive/30",
  concluido: "bg-accent/15 text-accent border border-accent/30",
};

export default function AdminFinancial() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "financial"],
    queryFn: () => api.admin.financial(),
  });

  const stats = data?.stats;
  const orders = data?.orders ?? [];

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
