import { useState } from "react";
import { Search, Inbox } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_PEDIDOS, type AdminPedidoMock } from "@/lib/adminMocks";

const statusBadge: Record<AdminPedidoMock["status"], string> = {
  "Em análise": "bg-primary/10 text-primary border border-primary/20",
  "Aguardando dados": "bg-destructive/10 text-destructive border border-destructive/30",
  Concluído: "bg-accent/15 text-accent border border-accent/30",
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminOrders() {
  const [selecionado, setSelecionado] = useState<AdminPedidoMock | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Todos os pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualização completa dos pedidos da plataforma. Ações de edição em breve.
          </p>
        </div>
        <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          {ADMIN_PEDIDOS.length} pedidos
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Pedidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ADMIN_PEDIDOS.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">Nenhum pedido encontrado.</p>
            </div>
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
                {ADMIN_PEDIDOS.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">Nº {p.numero}</TableCell>
                    <TableCell>{p.cliente}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.tipoServico}
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
                      {p.funcionario ?? (
                        <span className="italic text-destructive/80">Não vinculado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.prazoCliente}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Ver detalhes do pedido ${p.numero}`}
                        onClick={() => setSelecionado(p)}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selecionado} onOpenChange={(o) => !o && setSelecionado(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selecionado && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-3">
                  Pedido Nº {selecionado.numero}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                      statusBadge[selecionado.status],
                    )}
                  >
                    {selecionado.status}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Visão administrativa · somente leitura
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Cliente" value={selecionado.cliente} />
                <Field label="Funcionário vinculado" value={selecionado.funcionario ?? "—"} />
                <Field label="Tipo de serviço" value={selecionado.tipoServico} className="sm:col-span-2" />
                <Field label="Criado em" value={selecionado.criadoEm} />
                <Field label="Prazo cliente" value={selecionado.prazoCliente} />
                <Field label="Finalizado em" value={selecionado.finalizadoEm ?? "—"} />
                <Field label="Valor" value={formatBRL(selecionado.valor)} />
                <Field
                  label="Split plataforma"
                  value={`${selecionado.splitPlataforma}%`}
                />
                <Field
                  label="Split funcionário"
                  value={`${selecionado.splitFuncionario}%`}
                />
              </div>

              <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Ações de edição (vincular/desvincular funcionário, alterar status) serão liberadas em uma próxima atualização.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
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
