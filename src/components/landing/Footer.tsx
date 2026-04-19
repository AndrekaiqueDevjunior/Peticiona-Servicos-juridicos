import { Scale } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="bg-primary text-primary-foreground">
    <div className="container py-16">
      <div className="grid gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
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
            Plataforma de prestação de serviços jurídicos para advogados, escritórios e empresas
            que valorizam técnica, prazo e discrição.
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Plataforma</p>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">
            <li><a href="#servicos" className="hover:text-accent">Serviços</a></li>
            <li><a href="#planos" className="hover:text-accent">Planos</a></li>
            <li><a href="#faq" className="hover:text-accent">FAQ</a></li>
            <li><Link to="/auth" className="hover:text-accent">Entrar</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Legal</p>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">
            <li><a href="#" className="hover:text-accent">Termos de uso</a></li>
            <li><a href="#" className="hover:text-accent">Privacidade</a></li>
            <li><a href="#" className="hover:text-accent">LGPD</a></li>
            <li><a href="#" className="hover:text-accent">Contato</a></li>
          </ul>
        </div>
      </div>
      <div className="divider-gold mt-12" />
      <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs text-primary-foreground/60 md:flex-row">
        <p>© {new Date().getFullYear()} Lex Aurea. Todos os direitos reservados.</p>
        <p>CNPJ 00.000.000/0001-00 · Conformidade OAB</p>
      </div>
    </div>
  </footer>
);

export default Footer;
