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
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-primary/80" />
      <div className="absolute inset-0 bg-primary/40" />
    </div>

    <div className="container relative grid min-h-[640px] items-center py-24 md:py-32">
      <div className="max-w-2xl animate-fade-up">
        <div className="mb-6 inline-flex items-center gap-2 border border-accent/40 bg-primary/40 px-3 py-1 text-[11px] uppercase tracking-[0.22em] backdrop-blur text-secondary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Petições jurídicas sob demanda
        </div>
        <h1 className="font-display text-[2rem] leading-[1.1] sm:text-5xl md:text-6xl text-primary">
          Seu escritório pode produzir mais
          <span className="block italic text-accent">— sem você trabalhar mais.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-secondary-foreground">
          Enquanto você atende e fecha novos clientes, nós cuidamos das suas petições
          com precisão e agilidade.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground shadow-gold hover:bg-accent/90">
            <Link to="/auth?mode=signup">
              Adquirir agora <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent hover:bg-primary-foreground/10 text-secondary-foreground">
            <a href="#planos">Ver planos</a>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default Hero;
