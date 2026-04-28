import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export default function AdminPlans() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => api.admin.plans(),
  });

  const plans = data?.plans ?? [];
  const singleServices = data?.single_services ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Planos e preços
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize os valores praticados na plataforma. Edição em breve.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Planos mensais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando planos...</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="grid gap-2">
                <Label className="text-muted-foreground">{plan.name}</Label>
                <Input value={plan.monthly_price_brl} disabled />
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
              <div key={service.id} className="grid gap-2">
                <Label className="text-muted-foreground">{service.title}</Label>
                <Input value={service.unit_price_brl} disabled />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Edição de valores estará disponível em uma próxima atualização.
      </p>
    </div>
  );
}
