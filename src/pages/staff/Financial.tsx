import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, Loader2 } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type AdminOrderStatus, type StaffOrder } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pendente: "Em análise",
  em_andamento: "Aguardando dados",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_BADGE: Record<AdminOrderStatus, string> = {
  pendente: "bg-primary/10 text-primary border border-primary/20",
  em_andamento: "bg-destructive/10 text-destructive border border-destructive/30",
  concluido: "bg-accent/15 text-accent border border-accent/30",
  cancelado: "bg-muted text-muted-foreground border border-border",
};

const STATUS_DOT: Record<AdminOrderStatus, string> = {
  pendente: "bg-primary",
  em_andamento: "bg-destructive",
  concluido: "bg-accent",
  cancelado: "bg-muted-foreground",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const formatBRLFromCents = (value: number) =>
  (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const orderDate = (order: StaffOrder) => {
  const raw = order.created_at ?? order.deadline_at;
  if (!raw) return null;
  try {
    return parseISO(raw);
  } catch {
    return null;
  }
};

export default function StaffFinancial() {
  const [mes, setMes] = useState<string>("todos");
  const [ano, setAno] = useState<string>("todos");
  const { data, isLoading } = useQuery({
    queryKey: ["staff-financial"],
    queryFn: () => api.staff.financial(),
  });

  const orders = data?.orders ?? [];
  const anos = useMemo(() => {
    const set = new Set<number>();
    orders.forEach((order) => {
      const date = orderDate(order);
      if (date) set.add(date.getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [orders]);

  const filtrados = useMemo(() => {
    return orders.filter((order) => {
      const date = orderDate(order);
      if (!date) return true;
      if (ano !== "todos" && date.getFullYear() !== Number(ano)) return false;
      if (mes !== "todos" && date.getMonth() !== Number(mes)) return false;
      return true;
    });
  }, [orders, mes, ano]);

  const grupos = useMemo(() => {
    const map = new Map<string, StaffOrder[]>();
    filtrados
      .slice()
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .forEach((order) => {
        const date = orderDate(order);
        const key = date
          ? `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`
          : "sem-data";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(order);
      });
    return Array.from(map.entries());
  }, [filtrados]);

  const totalGeral = filtrados.reduce((sum, order) => sum + order.total_amount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos reais recebidos pela equipe, organizados por mês.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {MESES.map((month, index) => (
                  <SelectItem key={month} value={String(index)}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Ano</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                {anos.map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Valor total filtrado:</span>
            <span className="font-semibold text-primary">{formatBRLFromCents(totalGeral)}</span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando financeiro da equipe...
          </CardContent>
        </Card>
      ) : grupos.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhum pedido encontrado para o filtro selecionado.
          </CardContent>
        </Card>
      ) : (
        grupos.map(([key, list]) => {
          const [year, month] = key === "sem-data" ? [null, null] : key.split("-").map(Number);
          const subtotal = list.reduce((sum, order) => sum + order.total_amount, 0);
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="font-display text-lg">
                  {year === null ? "Sem data" : `${MESES[month ?? 0]} de ${year}`}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    · {list.length} {list.length === 1 ? "pedido" : "pedidos"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referência</TableHead>
                      <TableHead>Tipo de serviço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Concluído em</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.reference}</TableCell>
                        <TableCell>
                          <div className="text-foreground">{order.service_type}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.petition?.area_direito ?? "Sem área informada"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", STATUS_BADGE[order.status])}>
                            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[order.status])} />
                            {STATUS_LABEL[order.status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.created_at
                            ? format(parseISO(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.deadline_at
                            ? format(parseISO(order.deadline_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.completed_at
                            ? format(parseISO(order.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {order.total_brl || formatBRLFromCents(order.total_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableCell colSpan={6} className="text-right font-semibold">
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatBRLFromCents(subtotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
