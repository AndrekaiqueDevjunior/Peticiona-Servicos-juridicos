import { useMemo, useState } from "react";
import { Lock, Unlock, Plus } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ADMIN_FUNCIONARIOS, type AdminFuncionarioMock } from "@/lib/adminMocks";
import { isStaffActive, toggleStaffActive } from "@/lib/staffStatus";
import { useSyncExternalStore } from "react";
import { toast } from "@/hooks/use-toast";

// Subscriber simples para forçar re-render quando status muda.
const listeners = new Set<() => void>();
let tick = 0;
const notifyAll = () => {
  tick++;
  listeners.forEach((l) => l());
};
const useStatusTick = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => tick,
    () => tick,
  );

export default function AdminStaff() {
  useStatusTick();
  const [target, setTarget] = useState<AdminFuncionarioMock | null>(null);

  const funcionarios = useMemo(
    () =>
      ADMIN_FUNCIONARIOS.map((f) => ({
        ...f,
        ativo: isStaffActive(f.id),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  const handleConfirm = () => {
    if (!target) return;
    const next = toggleStaffActive(target.id);
    notifyAll();
    toast({
      title: next ? "Acesso liberado" : "Acesso bloqueado",
      description: next
        ? `${target.nome} pode voltar a entrar na plataforma.`
        : `${target.nome} não conseguirá mais fazer login até ser desbloqueado.`,
    });
    setTarget(null);
  };

  return (
    <TooltipProvider>
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
              {funcionarios.length} funcionários cadastrados
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
                {funcionarios.map((f) => (
                  <TableRow key={f.id} className={cn(!f.ativo && "opacity-60")}>
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
                            : "bg-destructive/15 text-destructive border border-destructive/30",
                        )}
                      >
                        {f.ativo ? "Ativo" : "Bloqueado"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTarget(f)}
                            aria-label={f.ativo ? "Bloquear acesso" : "Desbloquear acesso"}
                            className={cn(
                              f.ativo
                                ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                : "text-accent hover:bg-accent/10",
                            )}
                          >
                            {f.ativo ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {f.ativo ? "Bloquear acesso" : "Desbloquear acesso"}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          O bloqueio impede o login do funcionário e pode ser revertido a qualquer momento.
        </p>
      </div>

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.ativo ? "Bloquear acesso do funcionário?" : "Desbloquear acesso do funcionário?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.ativo ? (
                <>
                  <strong>{target?.nome}</strong> não conseguirá mais fazer login na plataforma
                  enquanto estiver bloqueado. Pedidos em andamento permanecem inalterados.
                  Você pode reverter essa ação a qualquer momento.
                </>
              ) : (
                <>
                  <strong>{target?.nome}</strong> voltará a ter acesso normal à plataforma e
                  poderá fazer login novamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                target?.ativo
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-accent text-accent-foreground hover:bg-accent/90",
              )}
            >
              {target?.ativo ? "Bloquear" : "Desbloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
