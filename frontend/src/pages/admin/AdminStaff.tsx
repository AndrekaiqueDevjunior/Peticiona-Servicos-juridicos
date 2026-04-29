import { useEffect, useState } from "react";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
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
import { api, type AdminStaffMember } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface StaffFormState {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  cpf: string;
  role_title: string;
  employee_code: string;
  is_active: boolean;
}

const emptyForm: StaffFormState = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  cpf: "",
  role_title: "",
  employee_code: "",
  is_active: true,
};

export default function AdminStaff() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api.admin.staff(),
  });
  const [editing, setEditing] = useState<AdminStaffMember | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<StaffFormState>(emptyForm);

  const staff = data?.staff ?? [];

  useEffect(() => {
    if (!editing) {
      setForm(emptyForm);
      return;
    }
    setForm({
      full_name: editing.nome,
      email: editing.email,
      password: "",
      phone: editing.telefone === "—" ? "" : editing.telefone,
      cpf: "",
      role_title: "",
      employee_code: "",
      is_active: editing.ativo,
    });
  }, [editing]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password.trim() || undefined,
        phone: form.phone.trim() || undefined,
        cpf: form.cpf.trim() || undefined,
        role_title: form.role_title.trim() || undefined,
        employee_code: form.employee_code.trim() || undefined,
        is_active: form.is_active,
      };
      if (editing) return api.admin.updateStaff(editing.id, payload);
      return api.admin.createStaff(payload);
    },
    onSuccess: () => {
      invalidate();
      setOpenForm(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Funcionário atualizado." : "Funcionário criado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar o funcionário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (item: AdminStaffMember) => api.admin.updateStaff(item.id, { is_active: !item.ativo }),
    onSuccess: (_, item) => {
      invalidate();
      toast({ title: item.ativo ? "Funcionário bloqueado." : "Funcionário reativado." });
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
    mutationFn: (staffId: number) => api.admin.deleteStaff(staffId),
    onSuccess: () => {
      invalidate();
      toast({ title: "Funcionário removido." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível remover o funcionário",
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
            Funcionários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRUD administrativo real para a equipe interna.
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
          Novo funcionário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">
            {isLoading ? "Carregando..." : `${staff.length} funcionários cadastrados`}
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
                {staff.map((item) => (
                  <TableRow key={item.id} className={cn(!item.ativo && "opacity-60")}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.telefone}</TableCell>
                    <TableCell className="text-right font-medium text-primary">{item.pedidos_ativos}</TableCell>
                    <TableCell className="text-right font-medium text-accent">{item.pedidos_concluidos}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          item.ativo
                            ? "bg-accent/15 text-accent border border-accent/30"
                            : "bg-destructive/15 text-destructive border border-destructive/30",
                        )}
                      >
                        {item.ativo ? "Ativo" : "Bloqueado"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(item);
                            setOpenForm(true);
                          }}
                          aria-label="Editar funcionário"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMutation.mutate(item)}
                          aria-label={item.ativo ? "Bloquear funcionário" : "Reativar funcionário"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(item.id)}
                          aria-label="Excluir funcionário"
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
            <DialogTitle>{editing ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <Field
              id="staff-name"
              label="Nome completo"
              value={form.full_name}
              onChange={(value) => setForm((current) => ({ ...current, full_name: value }))}
            />
            <Field
              id="staff-email"
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="staff-phone"
                label="Telefone"
                value={form.phone}
                onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              />
              <Field
                id="staff-cpf"
                label="CPF"
                value={form.cpf}
                onChange={(value) => setForm((current) => ({ ...current, cpf: value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="staff-role-title"
                label="Cargo"
                value={form.role_title}
                onChange={(value) => setForm((current) => ({ ...current, role_title: value }))}
              />
              <Field
                id="staff-employee-code"
                label="Matrícula"
                value={form.employee_code}
                onChange={(value) => setForm((current) => ({ ...current, employee_code: value }))}
              />
            </div>
            <Field
              id="staff-password"
              label={editing ? "Nova senha" : "Senha"}
              type="password"
              value={form.password}
              onChange={(value) => setForm((current) => ({ ...current, password: value }))}
            />
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
