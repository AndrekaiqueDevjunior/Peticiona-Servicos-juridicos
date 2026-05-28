import { Check, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function pricePerCreditLabel(plan: { monthly_price_cents: number; credits_quantity: number | null; price_per_service_cents: number | null }): string | null {
  if (plan.credits_quantity && plan.credits_quantity > 0) {
    return formatBRL(Math.round(plan.monthly_price_cents / plan.credits_quantity));
  }
  if (plan.price_per_service_cents != null) {
    return formatBRL(plan.price_per_service_cents);
  }
  return null;
}

function validityLabel(days: number | null): string | null {
  if (!days) return null;
  if (days % 365 === 0) return `${days / 365} ano${days / 365 > 1 ? "s" : ""} para usar seus créditos`;
  if (days % 30 === 0) return `${days / 30} ${days / 30 === 1 ? "mês" : "meses"} para usar seus créditos`;
  return `${days} dias para usar seus créditos`;
}

export const BuyCreditsDialog = ({ open, onOpenChange }: BuyCreditsDialogProps) => {
  const navigate = useNavigate();
  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => api.content.plans(),
  });
  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ["public-catalog"],
    queryFn: () => api.content.catalog(),
  });

  const services = (
    catalogData?.catalog.flatMap((section) =>
      section.items.map((item) => ({ ...item, section: section.section })),
    ) ?? []
  ).filter((s) => !["servico_express_upgrade", "servico_peticao_express", "servico_recurso_express"].includes(s.code));

  const goToCheckout = (serviceId: string) => {
    onOpenChange(false);
    navigate(`/checkout?service=${encodeURIComponent(serviceId)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comprar créditos</DialogTitle>
          <DialogDescription>
            1 crédito = 1 serviço jurídico. Escolha um pacote ou solicite avulso.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="planos" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planos">
              <Sparkles className="mr-2 h-4 w-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="avulsos">
              <Zap className="mr-2 h-4 w-4" />
              Avulsos
            </TabsTrigger>
          </TabsList>

          {/* ─── Planos ─── */}
          <TabsContent value="planos" className="mt-4">
            {loadingPlans ? (
              <p className="text-sm text-muted-foreground">Carregando planos...</p>
            ) : !plansData?.plans.length ? (
              <p className="text-sm text-muted-foreground">Nenhum plano ativo no backend.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {plansData.plans.map((plan) => {
                  const ctaLabel = plan.cta_label || `Adquirir ${plan.name}`;
                  const perCredit = pricePerCreditLabel(plan);
                  const validity = validityLabel(plan.validity_days);
                  const benefits = plan.benefits.length > 0 ? plan.benefits : plan.features;
                  return (
                    <div
                      key={plan.code}
                      className={`relative flex flex-col rounded-lg border bg-card p-5 ${
                        plan.is_highlighted ? "border-accent shadow-elegant" : "border-border"
                      }`}
                    >
                      {plan.is_highlighted && (
                        <span className="absolute -top-3 left-4 rounded-full bg-accent px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-accent-foreground">
                          Mais escolhido
                        </span>
                      )}
                      <h4 className="font-display text-lg font-semibold text-foreground">
                        {plan.name}
                      </h4>
                      {plan.subtitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{plan.subtitle}</p>
                      )}
                      <p className="mt-2 font-display text-2xl font-semibold text-primary">
                        {plan.monthly_price_brl}
                      </p>
                      {perCredit && (
                        <p className="mt-1 text-sm text-accent">{perCredit} por crédito</p>
                      )}

                      {/* créditos + validade */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {plan.credits_quantity != null && plan.credits_quantity > 0 && (
                          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                            {plan.credits_quantity} crédito{plan.credits_quantity !== 1 ? "s" : ""}
                          </span>
                        )}
                        {validity && (
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                            {validity}
                          </span>
                        )}
                      </div>

                      {benefits.length > 0 && (
                        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          {benefits.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <Button
                        type="button"
                        className={`mt-4 ${
                          plan.is_highlighted
                            ? "bg-accent text-accent-foreground hover:bg-accent/90"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                        onClick={() => goToCheckout(plan.code)}
                      >
                        {ctaLabel}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── Avulsos ─── */}
          <TabsContent value="avulsos" className="mt-4">
            {loadingCatalog ? (
              <p className="text-sm text-muted-foreground">Carregando serviços...</p>
            ) : !services.length ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço avulso ativo no backend.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {services.map((service) => {
                  return (
                    <div
                      key={service.code}
                      className="flex flex-col rounded-lg border bg-card p-4 border-border"
                    >
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {service.section}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <h4 className="font-medium text-foreground">{service.title}</h4>
                      </div>
                      <p className="mt-2 font-display text-xl font-semibold text-primary">
                        {formatBRL(service.unit_price)}
                      </p>
                      {service.delivery_label && (
                        <p className="mt-1 text-xs font-medium text-accent">
                          {service.delivery_label}
                        </p>
                      )}
                      {service.description && (
                        <p className="mt-2 flex-1 text-xs text-muted-foreground">
                          {service.description}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3"
                        onClick={() => goToCheckout(service.code)}
                      >
                        Solicitar avulso
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
