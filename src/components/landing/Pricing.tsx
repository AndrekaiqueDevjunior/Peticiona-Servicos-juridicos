import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Zap } from "lucide-react";

const benefits = [
  "Sem mensalidade",
  "Sem taxa de ativação",
  "1 ano para usar seus créditos",
];

const plans = [
  {
    name: "Essencial",
    price: "480",
    perService: "160",
    services: 3,
    tagline: "Para começar com previsibilidade",
    features: [
      "Entrega em até 3 dias úteis",
      "1 ano para utilização do pacote",
      "Sem limite de utilizações mensais",
      "Sem cobrança adicional por complexidade",
      "Atendimento humanizado",
    ],
  },
  {
    name: "Profissional",
    price: "750",
    perService: "150",
    services: 5,
    tagline: "Para escritórios em crescimento",
    featured: true,
    features: [
      "Entrega em até 3 dias úteis",
      "1 ano para utilização do pacote",
      "Sem limite de utilizações mensais",
      "Sem cobrança adicional por complexidade",
      "Atendimento humanizado",
      "Preço reduzido nos demais serviços da plataforma",
    ],
  },
  {
    name: "Estratégico",
    price: "2.800",
    perService: "140",
    services: 20,
    tagline: "Para alta demanda e escala",
    features: [
      "Entrega em até 2 dias úteis",
      "1 ano para utilização do pacote",
      "Sem limite de utilizações mensais",
      "Sem cobrança adicional por complexidade",
      "Atendimento humanizado",
      "Preço ainda mais reduzido nos demais serviços da plataforma",
    ],
  },
];

const avulsos = [
  { name: "Petição", price: "180", express: false },
  { name: "Recurso", price: "200", express: false },
  { name: "Petição Express", price: "230", note: "Entrega em 24h", express: true },
  { name: "Recurso Express", price: "260", note: "Entrega em 24h", express: true },
];

const Pricing = () => (
  <section id="planos" className="bg-secondary/50 py-24 md:py-32">
    <div className="container">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Planos</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">
          Pacotes de créditos com tudo incluso
        </h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
        <p className="mt-6 text-muted-foreground">
          Quanto maior o plano, menor o valor por serviço. Use os créditos no seu ritmo,
          sem limite mensal.
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
            <h3 className="font-display text-2xl">Plano {p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-5xl">{p.price}</span>
            </div>
            <p className="mt-2 text-sm text-accent">
              R$ {p.perService} por serviço
            </p>

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
              <Link to="/auth?mode=signup">Adquirir {p.name}</Link>
            </Button>
          </div>
        ))}
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

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {avulsos.map((a) => (
            <div
              key={a.name}
              className={`flex flex-col border bg-card p-6 shadow-card transition-elegant hover:border-accent/60 ${
                a.express ? "border-accent/40" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                {a.express && <Zap className="h-4 w-4 text-accent" />}
                <p className="font-display text-lg">{a.name}</p>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-xs text-muted-foreground">R$</span>
                <span className="font-display text-3xl">{a.price}</span>
              </div>
              {a.note && (
                <p className="mt-2 text-xs uppercase tracking-wider text-accent">{a.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default Pricing;
