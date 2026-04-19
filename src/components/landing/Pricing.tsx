import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Básico",
    price: "297",
    tagline: "Para profissionais autônomos",
    features: ["Até 3 serviços/mês", "10% de desconto em avulsos", "Suporte por e-mail", "Histórico ilimitado"],
  },
  {
    name: "Profissional",
    price: "697",
    tagline: "Para escritórios em crescimento",
    featured: true,
    features: ["Até 12 serviços/mês", "25% de desconto em avulsos", "Suporte prioritário", "Atribuição dedicada", "Relatórios mensais"],
  },
  {
    name: "Enterprise",
    price: "1.890",
    tagline: "Para escritórios estabelecidos",
    features: ["Serviços ilimitados", "40% de desconto em avulsos", "Gerente de conta", "SLA contratual", "API e integrações"],
  },
];

const Pricing = () => (
  <section id="planos" className="bg-secondary/50 py-24 md:py-32">
    <div className="container">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Investimento</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">Planos que acompanham sua jornada</h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
        <p className="mt-6 text-muted-foreground">
          Cancele quando quiser. Faturamento recorrente seguro via Stripe.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col border bg-card p-8 shadow-card transition-elegant ${
              p.featured ? "border-accent shadow-elegant md:-translate-y-4" : "border-border"
            }`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-accent-foreground">
                Mais escolhido
              </span>
            )}
            <h3 className="font-display text-2xl">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-5xl">{p.price}</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className={`mt-10 ${
                p.featured
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : "bg-primary text-primary-foreground hover:bg-primary-glow"
              }`}
            >
              <Link to="/auth?mode=signup">Assinar {p.name}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Pricing;
