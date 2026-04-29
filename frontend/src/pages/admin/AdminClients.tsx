import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { api, type AdminClient } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface ClientFormState {
  full_name: string;
  email: string;
  password: string;
  oab_number: string;
  phone: string;
  cpf: string;
  is_active: boolean;
}

const emptyForm: ClientFormState = {
  full_name: "",
  email: "",
  password: "",
  oab_number: "",
  phone: "",
  cpf: "",
  is_active: true,
};

export default function AdminClients() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: () => api.admin.clients(),
  });
  const [selected, setSelected] = useState<AdminClient | null>(null);
  const [editing, setEditing] = useState<AdminClient | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<ClientFormState>(emptyForm);

  const clients = data?.clients ?? [];

  useEffect(() => {
    if (!editing) {
      setForm(emptyForm);
      return;
    }
    setForm({
      full_name: editing.nome,
      email: editing.email,
      password: "",
      oab_number: editing.oab === "—" ? "" : editing.oab,
      phone: editing.telefone === "—" ? "" : editing.telefone,
      cpf: "",
      is_active: editing.ativo,
    });
  }, [editing]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password.trim() || undefined,
        oab_number: form.oab_number.trim() || undefined,
        phone: form.phone.trim() || undefined,
        cpf: form.cpf.trim() || undefined,
        is_active: form.is_active,
      };
      if (editing) {
        return api.admin.updateClient(editing.id, payload);
      }
      return api.admin.createClient(payload);
    },
    onSuccess: () => {
      invalidate();
      setOpenForm(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Cliente atualizado." : "Cliente criado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar o cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (client: AdminClient) =>
      api.admin.updateClient(client.id, { is_active: !client.ativo }),
    onSuccess: (_, client) => {
      invalidate();
      if (selected?.id === client.id) setSelected(null);
      toast({ title: client.ativo ? "Cliente bloqueado." : "Cliente reativado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível alterar o status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (clientId: number) => api.admin.deleteClient(clientId),
    onSuccess: () => {
      invalidate();
      setSelected(null);
      toast({ title: "Cliente removido." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível remover o cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Nome e e-mail são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (!editing && form.password.trim().length < 8) {
      toast({
        title: "Senha inválida",
        description: "Informe uma senha com pelo menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contrato administrativo fechado com persistência real no backend.
          </p>
        </div>
        <Button
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => {
            setEditing(null);
            setOpenForm(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">
            {isLoading ? "Carregando..." : `${clients.length} clientes cadastrados`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando clientes...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>OAB</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{client.oab}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{client.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{client.telefone}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {client.plano}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{client.cadastrado_em}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          client.ativo
                            ? "bg-accent/15 text-accent border border-accent/30"
                            : "bg-muted text-muted-foreground border border-border",
                        )}
                      >
                        {client.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelected(client)} aria-label="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(client);
                            setOpenForm(true);
                          }}
                          aria-label="Editar cliente"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMutation.mutate(client)}
                          aria-label={client.ativo ? "Bloquear cliente" : "Reativar cliente"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="client-name">Nome completo</Label>
              <Input
                id="client-name"
                value={form.full_name}
                onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-email">E-mail</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                id="client-phone"
                label="Telefone"
                value={form.phone}
                onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              />
              <Field
                id="client-cpf"
                label="CPF"
                value={form.cpf}
                onChange={(value) => setForm((current) => ({ ...current, cpf: value }))}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                id="client-oab"
                label="OAB"
                value={form.oab_number}
                onChange={(value) => setForm((current) => ({ ...current, oab_number: value }))}
              />
              <Field
                id="client-password"
                label={editing ? "Nova senha" : "Senha"}
                type="password"
                value={form.password}
                onChange={(value) => setForm((current) => ({ ...current, password: value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.nome}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="E-mail" value={selected.email} />
                <Detail label="Telefone" value={selected.telefone} />
                <Detail label="OAB" value={selected.oab} />
                <Detail label="Plano" value={selected.plano} />
                <Detail label="Cadastro" value={selected.cadastrado_em} />
                <Detail label="Status" value={selected.ativo ? "Ativo" : "Inativo"} />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(selected);
                    setOpenForm(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(selected.id)}
                >
                  Excluir
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
