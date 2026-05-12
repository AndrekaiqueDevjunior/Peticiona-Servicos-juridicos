import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { api, type AdminClient } from "@/lib/api";
import { BRAZILIAN_UF_OPTIONS } from "@/lib/clientProfile";
import { isValidCPF, maskCPF, maskOAB, maskPhone } from "@/lib/masks";

interface EditClientDialogProps {
  cliente: AdminClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditClientDialog = ({
  cliente,
  open,
  onOpenChange,
}: EditClientDialogProps) => {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [oabUf, setOabUf] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cliente) return;
    setFullName(cliente.full_name || cliente.nome || "");
    setEmail(cliente.email);
    setPhone(maskPhone(cliente.phone || (cliente.telefone === "—" ? "" : cliente.telefone)));
    setCpf(maskCPF(cliente.cpf || ""));
    setOabNumber(cliente.oab_number || "");
    setOabUf(cliente.oab_uf || "");
    setNewPassword("");
    setError(null);
  }, [cliente, open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!cliente) throw new Error("Cliente não selecionado.");
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        cpf: cpf.trim() || null,
        oab: oabNumber.trim() || null,
        oab_uf: oabUf.trim() || null,
      };
      const pwd = newPassword.trim();
      if (pwd) payload.password = pwd;
      return api.admin.clients.update(cliente.id, payload as Parameters<typeof api.admin.clients.update>[1]);
    },
    onSuccess: ({ client }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast({
        title: "Cadastro atualizado",
        description: `${client.nome} foi salvo no backend.`,
      });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: "Não foi possível salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  if (!cliente) return null;

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim()) {
      setError("Nome e e-mail são obrigatórios.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }

    if (cpf.trim() && !isValidCPF(cpf)) {
      setError("CPF inválido.");
      return;
    }

    if (newPassword.trim() && newPassword.trim().length < 8) {
      setError("Nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar cadastro do cliente</DialogTitle>
          <DialogDescription>
            As alterações são salvas diretamente no backend e recarregadas na tabela.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="adm-nome">Nome completo</Label>
            <Input
              id="adm-nome"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={160}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="adm-email">E-mail</Label>
            <Input
              id="adm-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={160}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-phone">Telefone / WhatsApp</Label>
            <Input
              id="adm-phone"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(maskPhone(event.target.value))}
              maxLength={20}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-cpf">CPF</Label>
            <Input
              id="adm-cpf"
              inputMode="numeric"
              value={cpf}
              onChange={(event) => setCpf(maskCPF(event.target.value))}
              maxLength={14}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-oab">Número OAB</Label>
            <Input
              id="adm-oab"
              inputMode="numeric"
              value={oabNumber}
              onChange={(event) => setOabNumber(maskOAB(event.target.value))}
              maxLength={10}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-oab-uf">UF da OAB</Label>
            <Select value={oabUf} onValueChange={(value) => setOabUf(value)}>
              <SelectTrigger id="adm-oab-uf">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {BRAZILIAN_UF_OPTIONS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <Label htmlFor="adm-password" className="text-sm font-semibold text-amber-900">
              Redefinir senha (opcional)
            </Label>
            <p className="text-xs text-amber-800">
              Deixe em branco para manter a senha atual. Mínimo 8 caracteres se preenchido.
            </p>
            <Input
              id="adm-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Nova senha do cliente"
              maxLength={100}
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {mutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
