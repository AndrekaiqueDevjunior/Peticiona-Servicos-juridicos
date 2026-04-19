import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import heroImage from "@/assets/hero-office.jpg";

const Hero = () => (
  <section className="relative overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <img
        src={heroImage}
        alt="Escritório de advocacia tradicional"
        width={1920}
        height={1080}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/40" />
    </div>

    <div className="container relative grid min-h-[640px] items-center py-24 md:py-32">
      <div className="max-w-2xl animate-fade-up">
        <div className="mb-6 inline-flex items-center gap-2 border border-accent/40 bg-primary/40 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-accent backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5" />
          Plataforma SaaS para advogados
        </div>
        <h1 className="font-display text-5xl leading-[1.05] text-primary-foreground md:text-7xl">
          A nova tradição da
          <span className="block italic text-accent">prática jurídica.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/80">
          Petições, pareceres e contratos elaborados por profissionais qualificados —
          gerenciados em uma plataforma única, com pagamentos seguros e entregas rastreáveis.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground shadow-gold hover:bg-accent/90">
            <Link to="/auth?mode=signup">
              Solicitar um serviço <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <a href="#planos">Ver planos</a>
          </Button>
        </div>

        <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-primary-foreground/15 pt-8">
          {[
            { k: "+2.400", v: "Peças entregues" },
            { k: "98%", v: "Satisfação" },
            { k: "24h", v: "Prazo médio" },
          ].map((s) => (
            <div key={s.v}>
              <dt className="font-display text-3xl text-accent">{s.k}</dt>
              <dd className="mt-1 text-xs uppercase tracking-wider text-primary-foreground/70">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  </section>
);

export default Hero;
