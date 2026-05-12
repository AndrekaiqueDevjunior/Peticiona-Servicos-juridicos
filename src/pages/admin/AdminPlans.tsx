import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, RotateCcw } from "lucide-react";
import { api, type AdminPlan, type AdminServiceCatalogItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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

  const updatePlan = (
    id: number,
    field: keyof AdminPlan,
    value: string | number | boolean | null | string[],
  ) => {
    setDraftPlans((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const updateService = (
    id: number,
    field: keyof AdminServiceCatalogItem,
    value: string | number | boolean | null,
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
            code: plan.code,
            name: plan.name,
            description: plan.description,
            monthly_price_cents: plan.monthly_price_cents,
            monthly_credits_cents: plan.monthly_credits_cents,
            petition_limit_monthly: plan.petition_limit_monthly,
            price_per_service_cents: plan.price_per_service_cents,
            features: plan.features,
            is_active: plan.is_active,
          }),
        ),
        ...changedServices.map((service) =>
          api.admin.pricing.updateService(service.id, {
            code: service.code,
            section: service.section,
            title: service.title,
            description: service.description,
            unit_price: service.unit_price,
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
        <CardHeader>
          <CardTitle className="font-display text-xl">Planos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {draftPlans.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-border p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">Codigo: {plan.code}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={plan.is_active}
                    onChange={(e) => updatePlan(plan.id, "is_active", e.target.checked)}
                  />
                  Ativo
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Codigo"
                  value={plan.code}
                  onChange={(value) => updatePlan(plan.id, "code", value)}
                />
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
                <Field
                  label="Preco mensal (centavos)"
                  type="number"
                  value={String(plan.monthly_price_cents)}
                  onChange={(value) => updatePlan(plan.id, "monthly_price_cents", Number(value) || 0)}
                />
                <Field
                  label="Creditos mensais (centavos)"
                  type="number"
                  value={String(plan.monthly_credits_cents)}
                  onChange={(value) => updatePlan(plan.id, "monthly_credits_cents", Number(value) || 0)}
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
                  label="Preco por servico adicional (centavos)"
                  type="number"
                  value={plan.price_per_service_cents == null ? "" : String(plan.price_per_service_cents)}
                  onChange={(value) =>
                    updatePlan(
                      plan.id,
                      "price_per_service_cents",
                      value === "" ? null : Number(value) || 0,
                    )
                  }
                />
                <TextareaField
                  label="Beneficios / features"
                  value={(plan.features ?? []).join("\n")}
                  onChange={(value) =>
                    updatePlan(
                      plan.id,
                      "features",
                      value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Servicos avulsos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {draftServices.map((service) => (
            <div key={service.id} className="rounded-lg border border-border p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{service.title}</p>
                  <p className="text-xs text-muted-foreground">Codigo: {service.code}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={service.is_active}
                    onChange={(e) => updateService(service.id, "is_active", e.target.checked)}
                  />
                  Ativo
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Codigo"
                  value={service.code}
                  onChange={(value) => updateService(service.id, "code", value)}
                />
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
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
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

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 md:col-span-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} />
    </div>
  );
}
