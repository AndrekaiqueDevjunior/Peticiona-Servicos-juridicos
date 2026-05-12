import { Sparkles, Zap } from "lucide-react";
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

  const services = catalogData?.catalog.flatMap((section) => section.items) ?? [];

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
                {plansData.plans.map((plan) => (
                  <div key={plan.code} className="flex flex-col rounded-lg border border-border bg-card p-5">
                    <h4 className="font-display text-lg font-semibold text-foreground">{plan.name}</h4>
                    <p className="mt-1 font-display text-2xl font-semibold text-primary">
                      {plan.monthly_price_brl}
                      <span className="text-sm font-normal text-muted-foreground">/mes</span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Creditos mensais: {formatBRLFromCents(plan.monthly_credits_cents)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Limite mensal: {plan.petition_limit_monthly ?? "sem limite"}
                    </p>
                    {plan.description && (
                      <p className="mt-3 flex-1 text-sm text-muted-foreground">{plan.description}</p>
                    )}
                    <Button
                      type="button"
                      className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={() => goToCheckout(plan.code)}
                    >
                      Assinar
                    </Button>
                  </div>
                ))}
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
                {services.map((service) => (
                  <div key={service.code} className="flex flex-col rounded-lg border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{service.code}</p>
                    <h4 className="mt-1 font-medium text-foreground">{service.title}</h4>
                    <p className="mt-2 font-display text-xl font-semibold text-primary">
                      {formatBRLFromCents(service.unit_price)}
                    </p>
                    <p className="mt-2 flex-1 text-xs text-muted-foreground">
                      {service.description || "Servico avulso do catalogo oficial."}
                    </p>
                    <Button type="button" variant="outline" className="mt-3" onClick={() => goToCheckout(service.code)}>
                      Comprar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
