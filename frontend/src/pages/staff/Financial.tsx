import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3 } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function StaffFinancial() {
  const { data, isLoading } = useQuery({
    queryKey: ["staff", "financial"],
    queryFn: () => api.staff.financial(),
  });

  const orders = data?.orders ?? [];
  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão real dos pedidos atribuídos e do repasse estimado.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Pedidos totais:</span>
            <span className="font-semibold text-primary">{summary?.total_orders ?? 0}</span>
          </div>
          <div className="rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Concluídos:</span>{" "}
            <span className="font-semibold text-primary">{summary?.completed_orders ?? 0}</span>
          </div>
          <div className="rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Repasse estimado:</span>{" "}
            <span className="font-semibold text-primary">{summary?.estimated_payout_brl ?? "R$ 0,00"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Pedidos vinculados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando dados financeiros...</p>
          ) : orders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido encontrado para este funcionário.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.reference}</TableCell>
                    <TableCell>{order.service_type}</TableCell>
                    <TableCell>{order.status_label}</TableCell>
                    <TableCell>
                      {order.created_at
                        ? format(parseISO(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {order.deadline_at
                        ? format(parseISO(order.deadline_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{order.total_brl}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
