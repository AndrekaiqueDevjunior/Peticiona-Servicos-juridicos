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
import { toast } from "@/hooks/use-toast";
import { api, type AdminStaffMember } from "@/lib/api";

interface EditStaffDialogProps {
  staff: AdminStaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStaffDialog({ staff, open, onOpenChange }: EditStaffDialogProps) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [cpf, setCpf] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!staff) return;
    setFullName(staff.nome);
    setEmail(staff.email);
    setPhone(staff.telefone === "—" ? "" : staff.telefone);
    setOabNumber(staff.oab ?? "");
    setCpf(staff.cpf ?? "");
    setRoleTitle(staff.role_title ?? "");
    setEmployeeCode(staff.employee_code ?? "");
    setZipCode(staff.zip_code ?? "");
    setStreet(staff.street ?? "");
    setStreetNumber(staff.street_number ?? "");
    setAddressComplement(staff.address_complement ?? "");
    setNeighborhood(staff.neighborhood ?? "");
    setCity(staff.city ?? "");
    setState(staff.state ?? "");
    setIsActive(staff.ativo);
    setError(null);
  }, [staff, open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!staff) throw new Error("Funcionário não selecionado.");
      return api.admin.staff.update(staff.id, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        oab_number: oabNumber.trim() || null,
        cpf: cpf.trim() || null,
        role_title: roleTitle.trim() || null,
        employee_code: employeeCode.trim() || null,
        zip_code: zipCode.trim() || null,
        street: street.trim() || null,
        street_number: streetNumber.trim() || null,
        address_complement: addressComplement.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
        is_active: isActive,
      });
    },
    onSuccess: ({ staff_member }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      toast({
        title: "Funcionário atualizado",
        description: `${staff_member.nome} foi salvo no backend.`,
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

  if (!staff) return null;

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

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar funcionário</DialogTitle>
          <DialogDescription>
            Dados do membro da equipe e permissões de acesso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="staff-edit-name">Nome completo</Label>
            <Input id="staff-edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={160} />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="staff-edit-email">E-mail</Label>
            <Input id="staff-edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-phone">Telefone</Label>
            <Input id="staff-edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-oab">OAB/UF</Label>
            <Input id="staff-edit-oab" value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} maxLength={40} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-cpf">CPF</Label>
            <Input id="staff-edit-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={20} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-role-title">Título/cargo</Label>
            <Input id="staff-edit-role-title" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} maxLength={120} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-code">Código interno</Label>
            <Input id="staff-edit-code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} maxLength={40} />
          </div>

          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Acesso ativo
          </label>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-zip">CEP</Label>
            <Input id="staff-edit-zip" value={zipCode} onChange={(e) => setZipCode(e.target.value)} maxLength={12} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-state">UF</Label>
            <Input id="staff-edit-state" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="staff-edit-street">Rua / avenida</Label>
            <Input id="staff-edit-street" value={street} onChange={(e) => setStreet(e.target.value)} maxLength={180} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-street-number">Número</Label>
            <Input id="staff-edit-street-number" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} maxLength={20} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-complement">Complemento</Label>
            <Input id="staff-edit-complement" value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)} maxLength={120} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-neighborhood">Bairro</Label>
            <Input id="staff-edit-neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} maxLength={120} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff-edit-city">Cidade</Label>
            <Input id="staff-edit-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {mutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
