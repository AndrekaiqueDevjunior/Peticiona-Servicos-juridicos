import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface EditClientDialogProps {
  cliente: AdminClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_PLAN_VALUE = "__sem_plano__";

export const EditClientDialog = ({
  cliente,
  open,
  onOpenChange,
}: EditClientDialogProps) => {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [cpf, setCpf] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [activePlanId, setActivePlanId] = useState(NO_PLAN_VALUE);
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: pricingData, isLoading: loadingPlans } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: () => api.admin.pricing.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!cliente) return;
    setFullName(cliente.nome);
    setEmail(cliente.email);
    setPhone(cliente.telefone === "—" ? "" : cliente.telefone);
    setOabNumber(cliente.oab === "—" ? "" : cliente.oab);
    setCpf(cliente.cpf ?? "");
    setRoleTitle(cliente.role_title ?? "");
    setEmployeeCode(cliente.employee_code ?? "");
    setActivePlanId(cliente.active_plan_id == null ? NO_PLAN_VALUE : String(cliente.active_plan_id));
    setZipCode(cliente.zip_code ?? "");
    setStreet(cliente.street ?? "");
    setStreetNumber(cliente.street_number ?? "");
    setAddressComplement(cliente.address_complement ?? "");
    setNeighborhood(cliente.neighborhood ?? "");
    setCity(cliente.city ?? "");
    setState(cliente.state ?? "");
    setError(null);
  }, [cliente, open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!cliente) throw new Error("Cliente nao selecionado.");
      return api.admin.clients.update(cliente.id, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        oab_number: oabNumber.trim() || null,
        cpf: cpf.trim() || null,
        role_title: roleTitle.trim() || null,
        employee_code: employeeCode.trim() || null,
        active_plan_id: activePlanId === NO_PLAN_VALUE ? null : Number(activePlanId),
        zip_code: zipCode.trim() || null,
        street: street.trim() || null,
        street_number: streetNumber.trim() || null,
        address_complement: addressComplement.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
      });
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
        title: "Nao foi possivel salvar",
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
      setError("Nome e e-mail sao obrigatorios.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail valido.");
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
            As alteracoes sao salvas diretamente no backend e recarregadas na tabela.
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
              onChange={(event) => setPhone(event.target.value)}
              maxLength={30}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-oab">OAB/UF</Label>
            <Input
              id="adm-oab"
              value={oabNumber}
              onChange={(event) => setOabNumber(event.target.value)}
              maxLength={40}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-cpf">CPF</Label>
            <Input
              id="adm-cpf"
              value={cpf}
              onChange={(event) => setCpf(event.target.value)}
              maxLength={20}
            />
          </div>

          <div className="grid gap-2">
            <Label>Plano ativo</Label>
            <Select value={activePlanId} onValueChange={setActivePlanId} disabled={loadingPlans}>
              <SelectTrigger>
                <SelectValue placeholder={loadingPlans ? "Carregando..." : "Sem plano"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAN_VALUE}>Sem plano</SelectItem>
                {(pricingData?.plans ?? []).map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.name}
                    {!plan.is_active ? " (inativo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-role-title">Título/cargo</Label>
            <Input
              id="adm-role-title"
              value={roleTitle}
              onChange={(event) => setRoleTitle(event.target.value)}
              maxLength={120}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-employee-code">Código interno</Label>
            <Input
              id="adm-employee-code"
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              maxLength={40}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-zip">CEP</Label>
            <Input
              id="adm-zip"
              value={zipCode}
              onChange={(event) => setZipCode(event.target.value)}
              maxLength={12}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-state">UF</Label>
            <Input
              id="adm-state"
              value={state}
              onChange={(event) => setState(event.target.value.toUpperCase())}
              maxLength={2}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="adm-street">Rua / avenida</Label>
            <Input
              id="adm-street"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              maxLength={180}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-street-number">Número</Label>
            <Input
              id="adm-street-number"
              value={streetNumber}
              onChange={(event) => setStreetNumber(event.target.value)}
              maxLength={20}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-complement">Complemento</Label>
            <Input
              id="adm-complement"
              value={addressComplement}
              onChange={(event) => setAddressComplement(event.target.value)}
              maxLength={120}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-neighborhood">Bairro</Label>
            <Input
              id="adm-neighborhood"
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              maxLength={120}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adm-city">Cidade</Label>
            <Input
              id="adm-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={120}
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
              {mutation.isPending ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
