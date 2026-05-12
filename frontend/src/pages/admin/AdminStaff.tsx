import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "@/hooks/use-toast";
import { NewStaffDialog } from "@/components/admin/NewStaffDialog";
import { api, type AdminStaffMember } from "@/lib/api";

export default function AdminStaff() {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => api.admin.staff.list(),
  });
  const funcionarios = data?.staff ?? [];
  const [target, setTarget] = useState<AdminStaffMember | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: (staff: AdminStaffMember) =>
      api.admin.staff.update(staff.id, { is_active: !staff.ativo }),
    onSuccess: ({ staff_member }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      toast({
        title: staff_member.ativo ? "Acesso liberado" : "Acesso bloqueado",
        description: staff_member.ativo
          ? `${staff_member.nome} pode voltar a entrar na plataforma.`
          : `${staff_member.nome} nao conseguira mais fazer login ate ser desbloqueado.`,
      });
      setTarget(null);
    },
    onError: (err) => {
      toast({
        title: "Nao foi possivel atualizar o funcionario",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    if (target) toggleMutation.mutate(target);
  };

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
              Funcionarios
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Equipe interna que executa os pedidos da plataforma.
            </p>
          </div>
          <Button
            onClick={() => setOpenNew(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="mr-2 h-4 w-4" /> Novo funcionario
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {isLoading
                ? "Carregando funcionarios..."
                : `${funcionarios.length} funcionarios cadastrados`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm text-destructive">
                {error instanceof Error ? error.message : "Erro ao carregar funcionarios."}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead className="text-right">Concluidos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Buscando funcionarios reais da API...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && funcionarios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum funcionario encontrado no backend.
                    </TableCell>
                  </TableRow>
                )}
                {funcionarios.map((staff) => (
                  <TableRow key={staff.id} className={cn(!staff.ativo && "opacity-60")}>
                    <TableCell className="font-medium">{staff.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{staff.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{staff.telefone}</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {staff.pedidos_ativos}
                    </TableCell>
                    <TableCell className="text-right font-medium text-accent">
                      {staff.pedidos_concluidos}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          staff.ativo
                            ? "bg-accent/15 text-accent border border-accent/30"
                            : "bg-destructive/15 text-destructive border border-destructive/30",
                        )}
                      >
                        {staff.ativo ? "Ativo" : "Bloqueado"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTarget(staff)}
                            aria-label={staff.ativo ? "Bloquear acesso" : "Desbloquear acesso"}
                            className={cn(
                              staff.ativo
                                ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                : "text-accent hover:bg-accent/10",
                            )}
                          >
                            {staff.ativo ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {staff.ativo ? "Bloquear acesso" : "Desbloquear acesso"}
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
          O bloqueio e salvo no backend e pode ser revertido a qualquer momento.
        </p>
      </div>

      <NewStaffDialog open={openNew} onOpenChange={setOpenNew} />

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.ativo ? "Bloquear acesso do funcionario?" : "Desbloquear acesso do funcionario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.ativo
                ? `${target.nome} nao conseguira mais fazer login na plataforma enquanto estiver bloqueado.`
                : `${target?.nome} voltara a ter acesso normal a plataforma.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={toggleMutation.isPending}
              className={cn(
                target?.ativo
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-accent text-accent-foreground hover:bg-accent/90",
              )}
            >
              {toggleMutation.isPending
                ? "Salvando..."
                : target?.ativo
                  ? "Bloquear"
                  : "Desbloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
