import { Scale, Instagram } from "lucide-react";

// TikTok icon (lucide doesn't include it)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1.84-.07Z" />
  </svg>
);

const Footer = () => (
  <footer className="bg-primary text-primary-foreground">
    <div className="container py-16">
      <div className="grid gap-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-primary-foreground/10">
              <Scale className="h-4 w-4 text-accent" />
            </span>
            <div>
              <p className="font-display text-lg">Lex Aurea</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60">Advocacia Digital</p>
            </div>
          </div>
          <p className="mt-6 max-w-md text-sm text-primary-foreground/70">
            Estrutura jurídica sob demanda para escritórios que querem produzir mais
            sem aumentar a equipe.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a
              href="#"
              aria-label="Instagram"
              className="grid h-9 w-9 place-items-center border border-primary-foreground/20 text-primary-foreground/80 transition-elegant hover:border-accent hover:text-accent"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="TikTok"
              className="grid h-9 w-9 place-items-center border border-primary-foreground/20 text-primary-foreground/80 transition-elegant hover:border-accent hover:text-accent"
            >
              <TikTokIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Navegação</p>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">
            <li><a href="#quem-somos" className="hover:text-accent">Quem somos</a></li>
            <li><a href="#planos" className="hover:text-accent">Preços</a></li>
            <li><a href="#contato" className="hover:text-accent">Contato</a></li>
          </ul>
        </div>

        <div id="contato">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Contato</p>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">
            <li>contato@lexaurea.com.br</li>
            <li>Atendimento Seg–Sex · 9h–18h</li>
          </ul>
        </div>
      </div>
      <div className="divider-gold mt-12" />
      <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs text-primary-foreground/60 md:flex-row">
        <p>© {new Date().getFullYear()} Lex Aurea. Todos os direitos reservados.</p>
        <p>Conformidade OAB · LGPD</p>
      </div>
    </div>
  </footer>
);

export default Footer;
