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

const formatBRLFromCents = (value: number) =>
  (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

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

  const services = catalogData?.catalog.flatMap((section) =>
    section.items.map((item) => ({ ...item, section: section.section })),
  ) ?? [];

  const goToCheckout = (serviceId: string) => {
    onOpenChange(false);
    navigate(`/checkout?service=${encodeURIComponent(serviceId)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comprar creditos</DialogTitle>
          <DialogDescription>
            Catalogo real carregado do backend. O checkout usa o codigo oficial de cada item.
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
              Servicos avulsos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planos" className="mt-4">
            {loadingPlans ? (
              <p className="text-sm text-muted-foreground">Carregando planos...</p>
            ) : !plansData?.plans.length ? (
              <p className="text-sm text-muted-foreground">Nenhum plano ativo no backend.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {plansData.plans.map((plan) => {
                  const ctaLabel = plan.cta_label || `Adquirir ${plan.name}`;
                  const pricePerService =
                    plan.price_per_service_cents != null
                      ? formatBRLFromCents(plan.price_per_service_cents)
                      : null;
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
                      <p className="mt-1 font-display text-2xl font-semibold text-primary">
                        {plan.monthly_price_brl}
                      </p>
                      {pricePerService && (
                        <p className="mt-1 text-sm text-accent">{pricePerService} por serviço</p>
                      )}
                      {plan.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                      )}
                      {plan.features?.length ? (
                        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
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

          <TabsContent value="avulsos" className="mt-4">
            {loadingCatalog ? (
              <p className="text-sm text-muted-foreground">Carregando catalogo...</p>
            ) : !services.length ? (
              <p className="text-sm text-muted-foreground">Nenhum servico avulso ativo no backend.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {services.map((service) => {
                  const isExpress = !!service.delivery_label && /24h/i.test(service.delivery_label);
                  return (
                    <div
                      key={service.code}
                      className={`flex flex-col rounded-lg border bg-card p-4 ${
                        isExpress ? "border-accent/50" : "border-border"
                      }`}
                    >
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {service.section}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {isExpress && <Zap className="h-4 w-4 text-accent" />}
                        <h4 className="font-medium text-foreground">{service.title}</h4>
                      </div>
                      <p className="mt-2 font-display text-xl font-semibold text-primary">
                        {formatBRLFromCents(service.unit_price)}
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
                        Comprar
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
