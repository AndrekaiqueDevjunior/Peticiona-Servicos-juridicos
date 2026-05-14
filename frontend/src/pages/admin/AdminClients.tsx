import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [pendingDelete, setPendingDelete] = useState<AdminClient | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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

  const deleteMutation = useMutation({
    mutationFn: (client: AdminClient) => api.admin.clients.delete(client.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast({ title: "Cliente excluído com sucesso." });
      setPendingDelete(null);
    },
    onError: (err) => {
      toast({
        title: "Não foi possível excluir o cliente",
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lista de todos os clientes cadastrados na plataforma.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir cliente"
                        onClick={() => setPendingDelete(client)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-clients"] })}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.nome} e todos os dados vinculados serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function CreateClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [oab, setOab] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setCpf("");
    setOab("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      toast({
        title: "Dados incompletos",
        description: "Nome, e-mail e senha (mínimo 8 caracteres) são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.admin.clients.create({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || null,
        cpf: cpf.trim() || null,
        oab_number: oab.trim() || null,
      });
      toast({ title: "Cliente criado com sucesso." });
      onCreated();
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Não foi possível criar o cliente",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!submitting) onOpenChange(value); if (!value) resetForm(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>
            Cadastre um novo cliente. Ele receberá acesso usando o e-mail e a senha definidos abaixo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-client-name">Nome completo *</Label>
            <Input
              id="new-client-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={150}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-client-email">E-mail *</Label>
              <Input
                id="new-client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-client-phone">Telefone</Label>
              <Input
                id="new-client-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-client-cpf">CPF</Label>
              <Input
                id="new-client-cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-client-oab">OAB</Label>
              <Input
                id="new-client-oab"
                value={oab}
                onChange={(e) => setOab(e.target.value)}
                maxLength={30}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-client-password">Senha provisória * (mín. 8 caracteres)</Label>
            <Input
              id="new-client-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Criando..." : "Criar cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
