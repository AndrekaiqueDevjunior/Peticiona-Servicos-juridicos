import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, Plus, Trash2, Zap, CreditCard, Info } from "lucide-react";
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

// Formata centavos como BRL legível
const fmtBRL = (cents: number | null | undefined) => {
  if (!cents) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

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
      toast({ title: "Plano desativado." });
      setPendingPlanDelete(null);
    },
    onError: (err) => {
      toast({ title: "Erro ao desativar", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (service: AdminServiceCatalogItem) => api.admin.pricing.deleteService(service.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["public-catalog"] });
      toast({ title: "Serviço desativado." });
      setPendingServiceDelete(null);
    },
    onError: (err) => {
      toast({ title: "Erro ao desativar", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
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

  const updatePlan = <K extends keyof AdminPlan>(id: number, field: K, value: AdminPlan[K]) => {
    setDraftPlans((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const updateService = <K extends keyof AdminServiceCatalogItem>(id: number, field: K, value: AdminServiceCatalogItem[K]) => {
    setDraftServices((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
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
            // novo modelo: créditos por unidade, não centavos
            credits_quantity: plan.credits_quantity ?? undefined,
            validity_days: plan.validity_days ?? undefined,
            // backward compat — backend sincroniza automaticamente
            monthly_credits_cents: plan.monthly_price_cents,
            petition_limit_monthly: plan.credits_quantity ?? plan.petition_limit_monthly,
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
      toast({ title: "Catálogo atualizado", description: "Valores salvos com sucesso." });
    } catch (err) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">Planos e créditos</h1>
        <p className="text-sm text-muted-foreground">Carregando catálogo...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">Planos e créditos</h1>
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar o catálogo do backend.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">Planos e créditos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            1 crédito = 1 serviço jurídico. Ao comprar um plano, o cliente recebe N créditos comuns.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={saving || !dirty}>
            <RotateCcw className="h-4 w-4" />
            Restaurar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!dirty || saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {/* Info box */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong>Modelo de créditos:</strong> cada plano libera N créditos comuns no saldo do cliente ao ser pago.
          1 crédito é consumido a cada pedido criado (petição ou recurso), independente do tipo.
          Express é cobrado à parte via checkout.
        </div>
      </div>

      {/* Planos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <CreditCard className="h-5 w-5 text-accent" />
            Planos de créditos
          </CardTitle>
          <Button type="button" size="sm" onClick={() => setCreatePlanOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo plano
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {draftPlans.map((plan) => {
            const creditsQty = plan.credits_quantity ?? null;
            const pricePerCredit = creditsQty && creditsQty > 0
              ? Math.round(plan.monthly_price_cents / creditsQty)
              : null;

            return (
              <div key={plan.id} className="rounded-lg border border-border bg-card p-5">
                {/* Cabeçalho do plano */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{plan.name}</span>
                    <Badge variant="outline" className="font-mono text-xs">{plan.code}</Badge>
                    {!plan.is_active && <Badge variant="secondary">Inativo</Badge>}
                    {plan.is_highlighted && <Badge className="bg-accent text-accent-foreground">Mais escolhido</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Button type="button" variant="ghost" size="icon" onClick={() => setPendingPlanDelete(plan)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={plan.is_active} onChange={(e) => updatePlan(plan.id, "is_active", e.target.checked)} />
                      Ativo
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={plan.is_highlighted} onChange={(e) => updatePlan(plan.id, "is_highlighted", e.target.checked)} />
                      Destacado
                    </label>
                  </div>
                </div>

                {/* Resumo rápido */}
                <div className="mb-4 flex flex-wrap gap-4 rounded-md bg-muted/50 p-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Preço do pacote</span>
                    <p className="font-semibold text-foreground">{fmtBRL(plan.monthly_price_cents)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Créditos inclusos</span>
                    <p className="font-semibold text-foreground">
                      {creditsQty != null ? `${creditsQty} crédito(s)` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Preço por crédito</span>
                    <p className="font-semibold text-accent">{fmtBRL(pricePerCredit)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Validade</span>
                    <p className="font-semibold text-foreground">
                      {plan.validity_days ? `${plan.validity_days} dias` : "365 dias"}
                    </p>
                  </div>
                </div>

                {/* Campos editáveis */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome" value={plan.name} onChange={(v) => updatePlan(plan.id, "name", v)} />
                  <Field label="Descrição" value={plan.description ?? ""} onChange={(v) => updatePlan(plan.id, "description", v)} />

                  <PriceInput
                    label="Preço do pacote"
                    valueCents={plan.monthly_price_cents}
                    onChangeCents={(c) => updatePlan(plan.id, "monthly_price_cents", c)}
                  />

                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Créditos inclusos *</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={creditsQty ?? ""}
                      onChange={(e) => updatePlan(plan.id, "credits_quantity", e.target.value === "" ? null : Number(e.target.value))}
                      placeholder="Ex: 3"
                    />
                    <p className="text-xs text-muted-foreground">Número de serviços jurídicos inclusos no pacote.</p>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Validade (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={plan.validity_days ?? 365}
                      onChange={(e) => updatePlan(plan.id, "validity_days" as keyof AdminPlan, Number(e.target.value) as AdminPlan[keyof AdminPlan])}
                    />
                  </div>

                  <Field label="Texto do botão (CTA)" value={plan.cta_label ?? ""} onChange={(v) => updatePlan(plan.id, "cta_label", v)} />

                  <div className="grid gap-2 md:col-span-2">
                    <Label className="text-muted-foreground">Benefícios exibidos (um por linha)</Label>
                    <textarea
                      className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={(plan.features ?? []).join("\n")}
                      onChange={(e) =>
                        updatePlan(plan.id, "features", e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Serviços avulsos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <Zap className="h-5 w-5 text-accent" />
            Serviços avulsos
          </CardTitle>
          <Button type="button" size="sm" onClick={() => setCreateServiceOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo serviço
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {draftServices.map((service) => {
            const isExpress = /express/i.test(service.code);
            const isUpgrade = service.code === "servico_express_upgrade";
            return (
              <div key={service.id} className={`rounded-lg border p-4 ${isExpress ? "border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/10" : "border-border"}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {isExpress && <Zap className="h-4 w-4 text-amber-500" />}
                    <span className="font-semibold text-foreground">{service.title}</span>
                    <Badge variant="outline" className="font-mono text-xs">{service.code}</Badge>
                    {isUpgrade && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Taxa de entrega express</Badge>}
                    {!service.is_active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Button type="button" variant="ghost" size="icon" onClick={() => setPendingServiceDelete(service)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={service.is_active} onChange={(e) => updateService(service.id, "is_active", e.target.checked)} />
                      Ativo
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Título" value={service.title} onChange={(v) => updateService(service.id, "title", v)} />
                  <Field label="Seção" value={service.section} onChange={(v) => updateService(service.id, "section", v)} />
                  <Field label="Descrição" value={service.description ?? ""} onChange={(v) => updateService(service.id, "description", v)} />
                  <PriceInput
                    label="Preço unitário"
                    valueCents={service.unit_price}
                    onChangeCents={(c) => updateService(service.id, "unit_price", c)}
                  />
                  <Field label="Etiqueta de entrega" value={service.delivery_label ?? ""} onChange={(v) => updateService(service.id, "delivery_label", v || null)} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Dialogs de criação */}
      <CreatePlanDialog open={createPlanOpen} onOpenChange={setCreatePlanOpen} onCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-pricing"] })} />
      <CreateServiceDialog open={createServiceOpen} onOpenChange={setCreateServiceOpen} onCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-pricing"] })} />

      {/* Confirm delete plan */}
      <AlertDialog open={!!pendingPlanDelete} onOpenChange={(open) => !open && setPendingPlanDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar este plano?</AlertDialogTitle>
            <AlertDialogDescription>
              O plano <strong>{pendingPlanDelete?.name}</strong> ({pendingPlanDelete?.code}) será desativado e não aparecerá mais no catálogo público.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlanMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingPlanDelete && deletePlanMutation.mutate(pendingPlanDelete)} disabled={deletePlanMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletePlanMutation.isPending ? "Desativando..." : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete service */}
      <AlertDialog open={!!pendingServiceDelete} onOpenChange={(open) => !open && setPendingServiceDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar este serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingServiceDelete?.title}</strong> ({pendingServiceDelete?.code}) será removido do catálogo público.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteServiceMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingServiceDelete && deleteServiceMutation.mutate(pendingServiceDelete)} disabled={deleteServiceMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteServiceMutation.isPending ? "Desativando..." : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog: Novo plano
// ---------------------------------------------------------------------------
function CreatePlanDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [monthlyPriceCents, setMonthlyPriceCents] = useState(0);
  const [creditsQty, setCreditsQty] = useState<number | "">(1);
  const [validityDays, setValidityDays] = useState<number>(365);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pricePerCredit = creditsQty && creditsQty > 0 && monthlyPriceCents > 0
    ? Math.round(monthlyPriceCents / Number(creditsQty))
    : null;

  const reset = () => {
    setCode(""); setName(""); setMonthlyPriceCents(0); setCreditsQty(1); setValidityDays(365); setDescription("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast({ title: "Dados incompletos", description: "Código e nome são obrigatórios.", variant: "destructive" });
      return;
    }
    if (monthlyPriceCents <= 0) {
      toast({ title: "Preço inválido", description: "Informe um preço maior que zero.", variant: "destructive" });
      return;
    }
    if (!creditsQty || Number(creditsQty) < 1) {
      toast({ title: "Créditos inválidos", description: "Informe ao menos 1 crédito.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api.admin.pricing.createPlan({
        code: code.trim(),
        name: name.trim(),
        monthly_price_cents: monthlyPriceCents,
        monthly_credits_cents: monthlyPriceCents,
        credits_quantity: Number(creditsQty),
        validity_days: validityDays,
        description: description.trim() || null,
        is_active: true,
      });
      toast({ title: "Plano criado." });
      onCreated();
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erro ao criar plano", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo plano de créditos</DialogTitle>
          <DialogDescription>
            Defina o preço do pacote e quantos créditos o cliente recebe ao comprá-lo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-plan-code">Código *</Label>
              <Input id="new-plan-code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={60} placeholder="plano_essencial" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-plan-name">Nome *</Label>
              <Input id="new-plan-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Plano Essencial" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PriceInput id="new-plan-price" label="Preço do pacote *" valueCents={monthlyPriceCents} onChangeCents={setMonthlyPriceCents} required />
            <div className="grid gap-2">
              <Label htmlFor="new-plan-credits">Créditos inclusos *</Label>
              <Input
                id="new-plan-credits"
                type="number"
                min={1}
                step={1}
                value={creditsQty}
                onChange={(e) => setCreditsQty(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="3"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-plan-validity">Validade (dias)</Label>
              <Input id="new-plan-validity" type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label>Preço por crédito (calculado)</Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {pricePerCredit ? (pricePerCredit / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-plan-description">Descrição</Label>
            <Input id="new-plan-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar plano"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Dialog: Novo serviço avulso
// ---------------------------------------------------------------------------
function CreateServiceDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [unitPriceCents, setUnitPriceCents] = useState(0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setCode(""); setTitle(""); setSection(""); setUnitPriceCents(0); setDescription(""); };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim() || !section.trim()) {
      toast({ title: "Dados incompletos", description: "Código, título e seção são obrigatórios.", variant: "destructive" });
      return;
    }
    if (unitPriceCents <= 0) {
      toast({ title: "Preço inválido", description: "Informe um preço maior que zero.", variant: "destructive" });
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
      toast({ title: "Erro ao criar serviço", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo serviço avulso</DialogTitle>
          <DialogDescription>Adicione um serviço avulso ao catálogo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-svc-code">Código *</Label>
              <Input id="new-svc-code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={60} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-svc-section">Seção *</Label>
              <Input id="new-svc-section" value={section} onChange={(e) => setSection(e.target.value)} required maxLength={80} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-svc-title">Título *</Label>
            <Input id="new-svc-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PriceInput id="new-svc-price" label="Preço unitário *" valueCents={unitPriceCents} onChangeCents={setUnitPriceCents} required />
            <div className="grid gap-2">
              <Label htmlFor="new-svc-description">Descrição</Label>
              <Input id="new-svc-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar serviço"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
