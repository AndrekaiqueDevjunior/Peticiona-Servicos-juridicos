import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Lock, Unlock } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { EditClientDialog } from "@/components/admin/EditClientDialog";
import { api, type AdminClient } from "@/lib/api";

export default function AdminClients() {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => api.admin.clients.list(),
  });
  const clientes = data?.clients ?? [];
  const [editing, setEditing] = useState<AdminClient | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<AdminClient | null>(null);

  const toggleMutation = useMutation({
    mutationFn: (client: AdminClient) =>
      api.admin.clients.update(client.id, { is_active: !client.ativo }),
    onSuccess: ({ client }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast({
        title: client.ativo ? "Conta reativada" : "Conta suspensa",
        description: client.ativo
          ? `${client.nome} já pode acessar normalmente.`
          : `${client.nome} não poderá acessar a plataforma.`,
      });
      setPendingToggle(null);
    },
    onError: (err) => {
      toast({
        title: "Não foi possível atualizar o cliente",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleOpenEdit = (client: AdminClient) => {
    setEditing(client);
    setEditOpen(true);
  };

  const handleConfirmToggle = () => {
    if (pendingToggle) toggleMutation.mutate(pendingToggle);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lista de todos os clientes cadastrados na plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">
            {isLoading ? "Carregando clientes..." : `${clientes.length} clientes cadastrados`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm text-destructive">
              {error instanceof Error ? error.message : "Erro ao carregar clientes."}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>OAB</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    Buscando clientes reais da API...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && clientes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum cliente encontrado no backend.
                  </TableCell>
                </TableRow>
              )}
              {clientes.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.cpf_formatado || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.oab_number || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.oab_uf || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{client.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.telefone_formatado || client.telefone}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {client.plano}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.cadastrado_em}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        client.ativo
                          ? "bg-accent/15 text-accent border border-accent/30"
                          : "bg-destructive/10 text-destructive border border-destructive/30",
                      )}
                    >
                      {client.ativo ? "Ativo" : "Suspenso"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Ver / editar cadastro"
                        onClick={() => handleOpenEdit(client)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={client.ativo ? "Suspender conta" : "Reativar conta"}
                        onClick={() => setPendingToggle(client)}
                        className={!client.ativo ? "text-destructive" : undefined}
                      >
                        {client.ativo ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Unlock className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditClientDialog
        cliente={editing}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditing(null);
        }}
      />

      <AlertDialog
        open={!!pendingToggle}
        onOpenChange={(open) => !open && setPendingToggle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle?.ativo ? "Suspender conta do cliente?" : "Reativar conta do cliente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.ativo
                ? `${pendingToggle.nome} ficara sem acesso a plataforma ate que voce reative a conta.`
                : `${pendingToggle?.nome} voltara a ter acesso a plataforma.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              disabled={toggleMutation.isPending}
              className={
                pendingToggle?.ativo
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-accent text-accent-foreground hover:bg-accent/90"
              }
            >
              {toggleMutation.isPending
                ? "Salvando..."
                : pendingToggle?.ativo
                  ? "Suspender"
                  : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
