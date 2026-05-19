import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw, Plus, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type AdminPlan, type AdminServiceCatalogItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PriceInput } from "@/components/admin/PriceInput";

export default function AdminPlans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: () => api.admin.pricing.list(),
  });

  const [draftPlans, setDraftPlans] = useState<AdminPlan[]>([]);
  const [draftServices, setDraftServices] = useState<AdminServiceCatalogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [pendingPlanDelete, setPendingPlanDelete] = useState<AdminPlan | null>(null);
  const [pendingServiceDelete, setPendingServiceDelete] = useState<AdminServiceCatalogItem | null>(null);

  const deletePlanMutation = useMutation({
    mutationFn: (plan: AdminPlan) => api.admin.pricing.deletePlan(plan.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["public-plans"] });
      toast({ title: "Plano excluído." });
      setPendingPlanDelete(null);
    },
    onError: (err) => {
      toast({
        title: "Não foi possível excluir o plano",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (service: AdminServiceCatalogItem) =>
      api.admin.pricing.deleteService(service.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["public-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["client-catalog"] });
      toast({ title: "Serviço excluído." });
      setPendingServiceDelete(null);
    },
    onError: (err) => {
      toast({
        title: "Não foi possível excluir o serviço",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!data) return;
    setDraftPlans(data.plans);
    setDraftServices(data.single_services);
  }, [data]);

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      JSON.stringify(draftPlans) !== JSON.stringify(data.plans) ||
      JSON.stringify(draftServices) !== JSON.stringify(data.single_services)
    );
  }, [data, draftPlans, draftServices]);

  const updatePlan = <K extends keyof AdminPlan>(
    id: number,
    field: K,
    value: AdminPlan[K],
  ) => {
    setDraftPlans((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const updateService = <K extends keyof AdminServiceCatalogItem>(
    id: number,
    field: K,
    value: AdminServiceCatalogItem[K],
  ) => {
    setDraftServices((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleReset = () => {
    if (!data) return;
    setDraftPlans(data.plans);
    setDraftServices(data.single_services);
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const changedPlans = draftPlans.filter((plan, index) => {
        const base = data.plans[index];
        return JSON.stringify(plan) !== JSON.stringify(base);
      });
      const changedServices = draftServices.filter((service, index) => {
        const base = data.single_services[index];
        return JSON.stringify(service) !== JSON.stringify(base);
      });

      await Promise.all([
        ...changedPlans.map((plan) =>
          api.admin.pricing.updatePlan(plan.id, {
            name: plan.name,
            description: plan.description,
            monthly_price_cents: plan.monthly_price_cents,
            monthly_credits_cents: plan.monthly_credits_cents,
            petition_limit_monthly: plan.petition_limit_monthly,
            price_per_service_cents: plan.price_per_service_cents,
            is_active: plan.is_active,
            is_highlighted: plan.is_highlighted,
            cta_label: plan.cta_label,
            features: plan.features,
          }),
        ),
        ...changedServices.map((service) =>
          api.admin.pricing.updateService(service.id, {
            section: service.section,
            title: service.title,
            description: service.description,
            unit_price: service.unit_price,
            delivery_label: service.delivery_label,
            is_active: service.is_active,
          }),
        ),
      ]);

      await queryClient.invalidateQueries({ queryKey: ["admin-pricing"] });
      await queryClient.invalidateQueries({ queryKey: ["public-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["public-catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["client-catalog"] });
      toast({
        title: "Catálogo atualizado",
        description: "Os valores reais do backend foram salvos com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Planos e preços
        </h1>
        <p className="text-sm text-muted-foreground">Carregando catálogo real do backend...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Planos e preços
        </h1>
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar o catálogo do backend.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Planos e preços
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edição direta do catálogo real do backend. Os planos vêm de `plans` e os avulsos de
            `service_catalog_items`.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={saving || !dirty}>
            <RotateCcw className="h-4 w-4" />
            Restaurar carregado
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-display text-xl">Planos</CardTitle>
          <Button
            type="button"
            size="sm"
            onClick={() => setCreatePlanOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo plano
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {draftPlans.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-border p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">Codigo: {plan.code}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingPlanDelete(plan)}
                    aria-label="Excluir plano"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={plan.is_active}
                      onChange={(e) => updatePlan(plan.id, "is_active", e.target.checked)}
                    />
                    Ativo
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={plan.is_highlighted}
                      onChange={(e) =>
                        updatePlan(plan.id, "is_highlighted", e.target.checked)
                      }
                    />
                    Mais escolhido
                  </label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Nome"
                  value={plan.name}
                  onChange={(value) => updatePlan(plan.id, "name", value)}
                />
                <Field
                  label="Descricao"
                  value={plan.description ?? ""}
                  onChange={(value) => updatePlan(plan.id, "description", value)}
                />
                <PriceInput
                  label="Preço mensal"
                  valueCents={plan.monthly_price_cents}
                  onChangeCents={(cents) => updatePlan(plan.id, "monthly_price_cents", cents)}
                />
                <PriceInput
                  label="Créditos mensais"
                  valueCents={plan.monthly_credits_cents}
                  onChangeCents={(cents) => updatePlan(plan.id, "monthly_credits_cents", cents)}
                />
                <PriceInput
                  label="Preço por serviço"
                  valueCents={plan.price_per_service_cents}
                  onChangeCents={(cents) => updatePlan(plan.id, "price_per_service_cents", cents)}
                  allowEmpty
                />
                <Field
                  label="Limite mensal de peticoes"
                  type="number"
                  value={plan.petition_limit_monthly == null ? "" : String(plan.petition_limit_monthly)}
                  onChange={(value) =>
                    updatePlan(
                      plan.id,
                      "petition_limit_monthly",
                      value === "" ? null : Number(value) || 0,
                    )
                  }
                />
                <Field
                  label="CTA do botao"
                  value={plan.cta_label ?? ""}
                  onChange={(value) => updatePlan(plan.id, "cta_label", value)}
                />
                <div className="grid gap-2 md:col-span-2">
                  <Label className="text-muted-foreground">
                    Beneficios (um por linha)
                  </Label>
                  <textarea
                    className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={(plan.features ?? []).join("\n")}
                    onChange={(e) =>
                      updatePlan(
                        plan.id,
                        "features",
                        e.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-display text-xl">Servicos avulsos</CardTitle>
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateServiceOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo serviço
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {draftServices.map((service) => (
            <div key={service.id} className="rounded-lg border border-border p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{service.title}</p>
                  <p className="text-xs text-muted-foreground">Codigo: {service.code}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingServiceDelete(service)}
                    aria-label="Excluir serviço"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={service.is_active}
                      onChange={(e) => updateService(service.id, "is_active", e.target.checked)}
                    />
                    Ativo
                  </label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Titulo"
                  value={service.title}
                  onChange={(value) => updateService(service.id, "title", value)}
                />
                <Field
                  label="Secao"
                  value={service.section}
                  onChange={(value) => updateService(service.id, "section", value)}
                />
                <Field
                  label="Descricao"
                  value={service.description ?? ""}
                  onChange={(value) => updateService(service.id, "description", value)}
                />
                <Field
                  label="Preco unitario (centavos)"
                  type="number"
                  value={String(service.unit_price)}
                  onChange={(value) => updateService(service.id, "unit_price", Number(value) || 0)}
                />
                <Field
                  label="Etiqueta de entrega"
                  value={service.delivery_label ?? ""}
                  onChange={(value) =>
                    updateService(service.id, "delivery_label", value || null)
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <CreatePlanDialog
        open={createPlanOpen}
        onOpenChange={setCreatePlanOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-pricing"] })}
      />
      <CreateServiceDialog
        open={createServiceOpen}
        onOpenChange={setCreateServiceOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-pricing"] })}
      />

      <AlertDialog
        open={!!pendingPlanDelete}
        onOpenChange={(open) => !open && setPendingPlanDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este plano?</AlertDialogTitle>
            <AlertDialogDescription>
              O plano {pendingPlanDelete?.name} ({pendingPlanDelete?.code}) será removido do catálogo público.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlanMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingPlanDelete && deletePlanMutation.mutate(pendingPlanDelete)}
              disabled={deletePlanMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlanMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingServiceDelete}
        onOpenChange={(open) => !open && setPendingServiceDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingServiceDelete?.title} ({pendingServiceDelete?.code}) será removido do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteServiceMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingServiceDelete && deleteServiceMutation.mutate(pendingServiceDelete)
              }
              disabled={deleteServiceMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteServiceMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreatePlanDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [monthlyPriceCents, setMonthlyPriceCents] = useState(0);
  const [monthlyCreditsCents, setMonthlyCreditsCents] = useState(0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCode("");
    setName("");
    setMonthlyPriceCents(0);
    setMonthlyCreditsCents(0);
    setDescription("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Código e nome são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (monthlyPriceCents <= 0) {
      toast({
        title: "Preço inválido",
        description: "Informe um preço maior que zero (ex.: 10 para R$ 10,00).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.admin.pricing.createPlan({
        code: code.trim(),
        name: name.trim(),
        monthly_price_cents: monthlyPriceCents,
        monthly_credits_cents: monthlyCreditsCents > 0 ? monthlyCreditsCents : monthlyPriceCents,
        description: description.trim() || null,
        is_active: true,
      });
      toast({ title: "Plano criado." });
      onCreated();
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Não foi possível criar o plano",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!submitting) onOpenChange(value);
        if (!value) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo plano</DialogTitle>
          <DialogDescription>
            Adicione um novo plano ao catálogo. Informe os valores em reais
            (ex.: 10 = R$ 10,00; 1500 = R$ 1.500,00).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-plan-code">Código *</Label>
              <Input
                id="new-plan-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={60}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-plan-name">Nome *</Label>
              <Input
                id="new-plan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PriceInput
              id="new-plan-price"
              label="Preço mensal"
              valueCents={monthlyPriceCents}
              onChangeCents={setMonthlyPriceCents}
              required
            />
            <PriceInput
              id="new-plan-credits"
              label="Créditos mensais"
              valueCents={monthlyCreditsCents}
              onChangeCents={setMonthlyCreditsCents}
              hint="Quanto vai entrar na carteira do cliente. Em branco = igual ao preço pago."
              allowEmpty
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-plan-description">Descrição</Label>
            <Input
              id="new-plan-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
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
              {submitting ? "Criando..." : "Criar plano"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateServiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [unitPriceCents, setUnitPriceCents] = useState(0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCode("");
    setTitle("");
    setSection("");
    setUnitPriceCents(0);
    setDescription("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim() || !section.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Código, título e seção são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (unitPriceCents <= 0) {
      toast({
        title: "Preço inválido",
        description: "Informe um preço maior que zero (ex.: 10 para R$ 10,00).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.admin.pricing.createService({
        code: code.trim(),
        title: title.trim(),
        section: section.trim(),
        unit_price: unitPriceCents,
        description: description.trim() || null,
        is_active: true,
      });
      toast({ title: "Serviço criado." });
      onCreated();
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Não foi possível criar o serviço",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!submitting) onOpenChange(value);
        if (!value) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo serviço avulso</DialogTitle>
          <DialogDescription>
            Adicione um novo serviço avulso. Informe o preço em reais
            (ex.: 10 = R$ 10,00).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-svc-code">Código *</Label>
              <Input
                id="new-svc-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={60}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-svc-section">Seção *</Label>
              <Input
                id="new-svc-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                required
                maxLength={80}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-svc-title">Título *</Label>
            <Input
              id="new-svc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PriceInput
              id="new-svc-price"
              label="Preço unitário"
              valueCents={unitPriceCents}
              onChangeCents={setUnitPriceCents}
              required
            />
            <div className="grid gap-2">
              <Label htmlFor="new-svc-description">Descrição</Label>
              <Input
                id="new-svc-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
              />
            </div>
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
              {submitting ? "Criando..." : "Criar serviço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
