import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3 } from "lucide-react";

import { cn } from "@/lib/utils";
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
import {
  STATUS_BADGE,
  STATUS_DOT,
  STATUS_LABEL,
  usePedidos,
  type Pedido,
} from "@/lib/pedidos";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function StaffFinancial() {
  const { pedidos } = usePedidos();
  const [mes, setMes] = useState<string>("todos");
  const [ano, setAno] = useState<string>("todos");

  const anos = useMemo(() => {
    const set = new Set<number>();
    pedidos.forEach((p) => set.add(parseISO(p.criadoEmISO).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [pedidos]);

  const filtrados = useMemo(() => {
    return pedidos.filter((p) => {
      const d = parseISO(p.criadoEmISO);
      if (ano !== "todos" && d.getFullYear() !== Number(ano)) return false;
      if (mes !== "todos" && d.getMonth() !== Number(mes)) return false;
      return true;
    });
  }, [pedidos, mes, ano]);

  // Agrupa por "AAAA-MM"
  const grupos = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    filtrados
      .slice()
      .sort((a, b) => b.criadoEmISO.localeCompare(a.criadoEmISO))
      .forEach((p) => {
        const d = parseISO(p.criadoEmISO);
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
      });
    return Array.from(map.entries());
  }, [filtrados]);

  const totalGeral = filtrados.reduce((s, p) => s + p.valor, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos recebidos organizados por mês, com subtotais de receita.
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
                {MESES.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
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
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Receita total filtrada:</span>
            <span className="font-semibold text-primary">{formatBRL(totalGeral)}</span>
          </div>
        </CardContent>
      </Card>

      {grupos.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhum pedido encontrado para o filtro selecionado.
          </CardContent>
        </Card>
      ) : (
        grupos.map(([key, list]) => {
          const [y, m] = key.split("-").map(Number);
          const subtotal = list.reduce((s, p) => s + p.valor, 0);
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="font-display text-lg">
                  {MESES[m]} de {y}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    · {list.length} {list.length === 1 ? "pedido" : "pedidos"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Tipo de serviço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Prazo cliente</TableHead>
                      <TableHead>Prazo interno</TableHead>
                      <TableHead>Entregue em</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">Nº {p.numero}</TableCell>
                        <TableCell>
                          <div className="text-foreground">
                            {p.tipoPeticao || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">{p.areaDireito}</div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                              STATUS_BADGE[p.status],
                            )}
                          >
                            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[p.status])} />
                            {STATUS_LABEL[p.status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(parseISO(p.criadoEmISO), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(parseISO(p.prazoEntregaClienteISO), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(parseISO(p.prazoEntregaInternoISO), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.finalizadoEmISO
                            ? format(parseISO(p.finalizadoEmISO), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBRL(p.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableCell colSpan={7} className="text-right font-semibold">
                        Subtotal {MESES[m]}/{y}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatBRL(subtotal)}
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
