import { Plus, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_FUNCIONARIOS } from "@/lib/adminMocks";

export default function AdminStaff() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Funcionários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Equipe interna que executa os pedidos da plataforma.
          </p>
        </div>
        <Button disabled className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="mr-2 h-4 w-4" /> Novo funcionário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">
            {ADMIN_FUNCIONARIOS.length} funcionários cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Concluídos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ADMIN_FUNCIONARIOS.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.telefone}</TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {f.pedidosAtivos}
                  </TableCell>
                  <TableCell className="text-right font-medium text-accent">
                    {f.pedidosConcluidos}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        f.ativo
                          ? "bg-accent/15 text-accent border border-accent/30"
                          : "bg-muted text-muted-foreground border border-border",
                      )}
                    >
                      {f.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" disabled aria-label="Ativar/desativar">
                      <Power className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Cadastro e ativação de funcionários serão liberados em uma próxima atualização.
      </p>
    </div>
  );
}
