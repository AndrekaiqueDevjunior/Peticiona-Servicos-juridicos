import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type AdminPlansData } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type PlanRecord = AdminPlansData["plans"][number];

interface PlanFormState {
  code: string;
  name: string;
  description: string;
  monthly_price_cents: string;
  monthly_credits_cents: string;
  petition_limit_monthly: string;
  is_active: boolean;
}

const emptyForm: PlanFormState = {
  code: "",
  name: "",
  description: "",
  monthly_price_cents: "0",
  monthly_credits_cents: "0",
  petition_limit_monthly: "",
  is_active: true,
};

export default function AdminPlans() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => api.admin.plans(),
  });
  const [editing, setEditing] = useState<PlanRecord | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<PlanFormState>(emptyForm);

  const plans = data?.plans ?? [];
  const singleServices = data?.single_services ?? [];

  useEffect(() => {
    if (!editing) {
      setForm(emptyForm);
      return;
    }
    setForm({
      code: editing.code,
      name: editing.name,
      description: editing.description ?? "",
      monthly_price_cents: String(editing.monthly_price_cents),
      monthly_credits_cents: String(editing.monthly_credits_cents),
      petition_limit_monthly: editing.petition_limit_monthly == null ? "" : String(editing.petition_limit_monthly),
      is_active: editing.is_active,
    });
  }, [editing]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        monthly_price_cents: Number(form.monthly_price_cents),
        monthly_credits_cents: Number(form.monthly_credits_cents),
        petition_limit_monthly: form.petition_limit_monthly ? Number(form.petition_limit_monthly) : null,
        is_active: form.is_active,
      };
      if (editing) return api.admin.updatePlan(editing.id, payload);
      return api.admin.createPlan(payload);
    },
    onSuccess: () => {
      invalidate();
      setOpenForm(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Plano atualizado." : "Plano criado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar o plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (planId: number) => api.admin.deletePlan(planId),
    onSuccess: () => {
      invalidate();
      toast({ title: "Plano removido." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível remover o plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Código e nome são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Planos e preços
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRUD real para planos. Os serviços avulsos ainda estão em modo catálogo.
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
          Novo plano
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Planos mensais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando planos...</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{plan.name}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{plan.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(plan);
                        setOpenForm(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(plan.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <p>Mensalidade: {plan.monthly_price_brl}</p>
                  <p>Créditos: {plan.monthly_credits_brl}</p>
                  <p>Limite mensal: {plan.petition_limit_monthly ?? "Ilimitado"}</p>
                  <p>Status: {plan.is_active ? "Ativo" : "Inativo"}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Serviços avulsos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando serviços...</p>
          ) : (
            singleServices.map((service) => (
              <div key={service.id} className="grid gap-2 rounded-md border border-border p-4">
                <Label className="text-muted-foreground">{service.title}</Label>
                <Input value={service.unit_price_brl} disabled />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="plan-code"
                label="Código"
                value={form.code}
                disabled={!!editing}
                onChange={(value) => setForm((current) => ({ ...current, code: value }))}
              />
              <Field
                id="plan-name"
                label="Nome"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              />
            </div>
            <Field
              id="plan-description"
              label="Descrição"
              value={form.description}
              onChange={(value) => setForm((current) => ({ ...current, description: value }))}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                id="plan-price"
                label="Mensalidade (centavos)"
                type="number"
                value={form.monthly_price_cents}
                onChange={(value) => setForm((current) => ({ ...current, monthly_price_cents: value }))}
              />
              <Field
                id="plan-credits"
                label="Créditos mensais"
                type="number"
                value={form.monthly_credits_cents}
                onChange={(value) => setForm((current) => ({ ...current, monthly_credits_cents: value }))}
              />
              <Field
                id="plan-limit"
                label="Limite de petições"
                type="number"
                value={form.petition_limit_monthly}
                onChange={(value) => setForm((current) => ({ ...current, petition_limit_monthly: value }))}
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
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  disabled = false,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
