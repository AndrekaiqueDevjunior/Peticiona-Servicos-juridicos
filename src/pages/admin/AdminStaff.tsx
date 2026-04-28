import { useQuery } from "@tanstack/react-query";
import { Lock, Plus } from "lucide-react";
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
import { api } from "@/lib/api";

export default function AdminStaff() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api.admin.staff(),
  });

  const funcionarios = data?.staff ?? [];

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
            {isLoading ? "Carregando..." : `${funcionarios.length} funcionários cadastrados`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando funcionários...</p>
          ) : (
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
                {funcionarios.map((f) => (
                  <TableRow key={f.id} className={cn(!f.ativo && "opacity-60")}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.telefone}</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {f.pedidos_ativos}
                    </TableCell>
                    <TableCell className="text-right font-medium text-accent">
                      {f.pedidos_concluidos}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          f.ativo
                            ? "bg-accent/15 text-accent border border-accent/30"
                            : "bg-destructive/15 text-destructive border border-destructive/30",
                        )}
                      >
                        {f.ativo ? "Ativo" : "Bloqueado"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" disabled aria-label="Bloquear acesso">
                        <Lock className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        O bloqueio de acesso será disponibilizado em uma próxima atualização.
      </p>
    </div>
  );
}
