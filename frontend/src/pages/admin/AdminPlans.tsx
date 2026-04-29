import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type AdminPlansData, type AdminService } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type PlanRecord = AdminPlansData["plans"][number];
type ServiceRecord = AdminService;

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

interface ServiceFormState {
  code: string;
  section: string;
  title: string;
  description: string;
  unit_price: string;
}

const emptyServiceForm: ServiceFormState = {
  code: "",
  section: "",
  title: "",
  description: "",
  unit_price: "0",
};

export default function AdminPlans() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => api.admin.plans(),
  });
  const [editing, setEditing] = useState<PlanRecord | null>(null);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openServiceForm, setOpenServiceForm] = useState(false);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(emptyServiceForm);

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

  useEffect(() => {
    if (!editingService) {
      setServiceForm(emptyServiceForm);
      return;
    }
    setServiceForm({
      code: editingService.code,
      section: editingService.section,
      title: editingService.title,
      description: editingService.description ?? "",
      unit_price: String(editingService.unit_price),
    });
  }, [editingService]);

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
  const serviceMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: serviceForm.code.trim(),
        section: serviceForm.section.trim(),
        title: serviceForm.title.trim(),
        description: serviceForm.description.trim() || undefined,
        unit_price: Number(serviceForm.unit_price),
        is_active: true,
      };
      if (editingService) return api.admin.updateService(editingService.id, payload);
      return api.admin.createService(payload);
    },
    onSuccess: () => {
      invalidate();
      setOpenServiceForm(false);
      setEditingService(null);
      setServiceForm(emptyServiceForm);
      toast({ title: editingService ? "Serviço atualizado." : "Serviço criado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar o serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: number) => api.admin.deleteService(serviceId),
    onSuccess: () => {
      invalidate();
      toast({ title: "Serviço desativado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível remover o serviço",
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
            CRUD real para planos mensais e serviços avulsos do catálogo.
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl">Serviços avulsos</CardTitle>
          <Button
            variant="outline"
            onClick={() => {
              setEditingService(null);
              setOpenServiceForm(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo serviço
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando serviços...</p>
          ) : (
            singleServices.map((service) => (
              <div key={service.id} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{service.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.section} · {service.code}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingService(service);
                        setOpenServiceForm(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteServiceMutation.mutate(service.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <p>Preço: {service.unit_price_brl}</p>
                  <p>Status: {service.is_active ? "Ativo" : "Inativo"}</p>
                  {service.description && <p>{service.description}</p>}
                </div>
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

      <Dialog open={openServiceForm} onOpenChange={setOpenServiceForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!serviceForm.code.trim() || !serviceForm.section.trim() || !serviceForm.title.trim()) {
                toast({
                  title: "Preencha os campos obrigatórios",
                  description: "Código, seção e título são obrigatórios.",
                  variant: "destructive",
                });
                return;
              }
              serviceMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="service-code"
                label="Código"
                value={serviceForm.code}
                disabled={!!editingService}
                onChange={(value) => setServiceForm((current) => ({ ...current, code: value }))}
              />
              <Field
                id="service-section"
                label="Seção"
                value={serviceForm.section}
                onChange={(value) => setServiceForm((current) => ({ ...current, section: value }))}
              />
            </div>
            <Field
              id="service-title"
              label="Título"
              value={serviceForm.title}
              onChange={(value) => setServiceForm((current) => ({ ...current, title: value }))}
            />
            <Field
              id="service-description"
              label="Descrição"
              value={serviceForm.description}
              onChange={(value) => setServiceForm((current) => ({ ...current, description: value }))}
            />
            <Field
              id="service-price"
              label="Preço (centavos)"
              type="number"
              value={serviceForm.unit_price}
              onChange={(value) => setServiceForm((current) => ({ ...current, unit_price: value }))}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenServiceForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={serviceMutation.isPending}>
                {serviceMutation.isPending ? "Salvando..." : "Salvar"}
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
