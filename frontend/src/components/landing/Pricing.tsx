import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const Pricing = () => {
  const { data: catalogData, isLoading } = useQuery({
    queryKey: ["public-catalog"],
    queryFn: () => api.content.catalog(),
  });

  const plans = catalogData?.plans ?? [];
  const services = catalogData?.services ?? [];

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
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {isLoading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground md:col-span-3">
              Carregando planos disponíveis...
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground md:col-span-3">
              Nenhum plano público ativo foi encontrado.
            </div>
          ) : (
            plans.map((plan) => {
              const highlighted = plan.is_highlighted;
              const benefits = plan.benefits.length > 0 ? plan.benefits : plan.features;
              return (
                <div
                  key={plan.code}
                  className={`relative flex flex-col border bg-card p-8 shadow-card transition-elegant ${
                    highlighted ? "border-accent shadow-elegant md:-translate-y-4" : "border-border"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-accent-foreground">
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="font-display text-2xl">{plan.name}</h3>
                  {plan.subtitle && (
                    <p className="mt-1 text-sm text-muted-foreground">{plan.subtitle}</p>
                  )}

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="font-display text-5xl">
                      {plan.price_formatted}
                    </span>
                  </div>

                  {plan.unit_price_formatted && (
                    <p className="mt-2 text-sm text-accent">
                      {plan.unit_price_formatted} por serviço
                      {plan.credits_quantity ? ` · ${plan.credits_quantity} créditos` : ""}
                    </p>
                  )}

                  {plan.delivery_label && (
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                      {plan.delivery_label}
                    </p>
                  )}

                  <ul className="mt-8 space-y-3 text-sm">
                    {benefits.map((benefit) => (
                      <li key={benefit} className="flex gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={`mt-10 ${
                      highlighted
                        ? "bg-accent text-accent-foreground hover:bg-accent/90"
                        : "bg-primary text-primary-foreground hover:bg-primary-glow"
                    }`}
                  >
                    <Link to={`/auth?mode=signup&plan=${encodeURIComponent(plan.code)}`}>
                      {plan.cta_label || `Adquirir ${plan.name}`}
                    </Link>
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Serviços avulsos */}
        <div className="mt-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Avulsos</p>
            <h3 className="mt-3 font-display text-3xl md:text-4xl">
              Sem plano? Solicite por demanda.
            </h3>
            <div className="divider-gold mx-auto mt-6 w-24" />
          </div>

          {isLoading ? (
            <div className="mt-10 rounded-xl border border-border bg-card p-6 text-center shadow-card">
              <p className="text-sm text-muted-foreground">Carregando serviços avulsos...</p>
            </div>
          ) : services.length > 0 ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((service) => {
                const express = /express|24h/i.test(`${service.code} ${service.name} ${service.delivery_label ?? ""}`);
                return (
                  <div
                    key={service.code}
                    className={`flex flex-col border bg-card p-6 shadow-card transition-elegant hover:border-accent/60 ${
                      express ? "border-accent/40" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {express && <Zap className="h-4 w-4 text-accent" />}
                      <p className="font-display text-lg">{service.name}</p>
                    </div>
                    {service.section && (
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                        {service.section}
                      </p>
                    )}
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-display text-3xl">{service.price_formatted}</span>
                    </div>
                    {service.delivery_label && (
                      <p className="mt-2 text-xs text-muted-foreground">{service.delivery_label}</p>
                    )}
                    {service.description && (
                      <p className="mt-2 text-xs text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                );
              })}
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
