import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Scale } from "lucide-react";

const links = [
  { href: "#servicos", label: "Serviços" },
  { href: "#planos", label: "Planos" },
  { href: "#depoimentos", label: "Depoimentos" },
  { href: "#faq", label: "FAQ" },
];

const Navbar = () => (
  <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
    <div className="container flex h-16 items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-sm bg-primary text-primary-foreground">
          <Scale className="h-4 w-4 text-accent" />
        </span>
        <div className="leading-none">
          <p className="font-display text-lg font-semibold tracking-tight">Lex Aurea</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Advocacia Digital</p>
        </div>
      </Link>
      <nav className="hidden items-center gap-8 md:flex">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {l.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link to="/auth">Entrar</Link>
        </Button>
        <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary-glow">
          <Link to="/auth?mode=signup">Começar agora</Link>
        </Button>
      </div>
    </div>
  </header>
);

export default Navbar;
