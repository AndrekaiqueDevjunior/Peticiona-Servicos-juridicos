import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const benefits = [
  "Sem mensalidade",
  "Sem taxa de ativação",
  "1 ano para usar seus créditos",
];

const formatPrice = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Preço por serviço e features específicas por código de plano
const PLAN_PRICE_PER_SERVICE: Record<string, number> = {
  essencial: 160,
  profissional: 150,
  estrategico: 140,
};

const BASE_FEATURES = [
  "Entrega em até 3 dias úteis",
  "1 ano para utilização do pacote",
  "Sem limite de utilizações mensais",
  "Sem cobrança adicional por complexidade",
  "Atendimento humanizado",
];

const PLAN_EXTRA_FEATURES: Record<string, string[]> = {
  estrategico: [
    "Entrega em até 2 dias úteis",
    "1 ano para utilização do pacote",
    "Sem limite de utilizações mensais",
    "Sem cobrança adicional por complexidade",
    "Atendimento humanizado",
    "Preço ainda mais reduzido nos demais serviços da plataforma",
  ],
  profissional: [
    ...BASE_FEATURES,
    "Preço reduzido nos demais serviços da plataforma",
  ],
};

const getPlanFeatures = (code: string) =>
  PLAN_EXTRA_FEATURES[code] ?? BASE_FEATURES;

const Pricing = () => {
  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => api.content.plans(),
  });
  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ["public-catalog"],
    queryFn: () => api.content.catalog(),
  });

  const plans = plansData?.plans ?? [];
  const avulsos = catalogData?.catalog.flatMap((section) =>
    section.items.map((item) => ({
      code: item.code,
      section: section.section,
      name: item.title,
      price: item.unit_price / 100,
      express: /express/i.test(`${item.code} ${item.title}`),
      note: item.description || undefined,
    })),
  ) ?? [];

  return (
  <section id="planos" className="bg-secondary/50 py-24 md:py-32">
    <div className="container">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Planos</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">
          Pacotes de créditos com tudo incluso
        </h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
        <p className="mt-6 text-muted-foreground">
          Escolha o plano ideal para suas necessidades jurídicas com transparência e flexibilidade.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-foreground/80">
          {benefits.map((b) => (
            <span key={b} className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" />
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {loadingPlans ? (
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground md:col-span-3">
            Carregando planos disponíveis...
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground md:col-span-3">
            Nenhum plano público ativo foi encontrado.
          </div>
        ) : plans.map((plan, index) => {
          const pricePerService = PLAN_PRICE_PER_SERVICE[plan.code];
          const features = getPlanFeatures(plan.code);
          return (
          <div
            key={plan.code}
            className={`relative flex flex-col border bg-card p-8 shadow-card transition-elegant ${
              index === 1 ? "border-accent shadow-elegant md:-translate-y-4" : "border-border"
            }`}
          >
            {index === 1 && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-accent-foreground">
                Mais escolhido
              </span>
            )}
            <h3 className="font-display text-2xl">{plan.name}</h3>
            {plan.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description}
              </p>
            )}

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-5xl">{formatPrice(plan.monthly_price_cents / 100)}</span>
            </div>
            {pricePerService && (
              <p className="mt-2 text-sm text-accent">
                R$ {pricePerService} por serviço
              </p>
            )}

            <ul className="mt-8 space-y-3 text-sm">
              {features.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className={`mt-10 ${
                index === 1
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : "bg-primary text-primary-foreground hover:bg-primary-glow"
              }`}
            >
              <Link to="/auth?mode=signup">Adquirir {plan.name}</Link>
            </Button>
          </div>
          );
        })}
      </div>

      {/* Valores avulsos */}
      <div className="mt-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Avulsos</p>
          <h3 className="mt-3 font-display text-3xl md:text-4xl">
            Sem plano? Solicite por demanda.
          </h3>
          <div className="divider-gold mx-auto mt-6 w-24" />
        </div>

        {loadingCatalog ? (
          <div className="mt-10 rounded-xl border border-border bg-card p-6 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              Planos e créditos carregados do catálogo oficial da plataforma, refletindo os valores atualizados.
            </p>
          </div>
        ) : avulsos.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {avulsos.map((a) => (
              <div
                key={a.code}
                className={`flex flex-col border bg-card p-6 shadow-card transition-elegant hover:border-accent/60 ${
                  a.express ? "border-accent/40" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  {a.express && <Zap className="h-4 w-4 text-accent" />}
                  <p className="font-display text-lg">{a.name}</p>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {a.section}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <span className="font-display text-3xl">{formatPrice(a.price)}</span>
                </div>
                {a.note && (
                  <p className="mt-2 text-xs text-muted-foreground">{a.note}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-xl border border-border bg-card p-6 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              Nenhum serviço avulso público foi encontrado.
            </p>
          </div>
        )}
      </div>
    </div>
  </section>
  );
};

export default Pricing;
