import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/peticiona-logo.png";

const links = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
  { href: "#contato", label: "Contato" },
];

const Navbar = () => (
  <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
    <div className="container flex h-16 items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5" aria-label="Peticiona — início">
        <img src={logo} alt="Peticiona Serviços Jurídicos" className="h-9 w-9 object-contain" />
        <div className="leading-none">
          <p className="font-display text-lg font-semibold tracking-tight text-primary">PETICIONA</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Serviços Jurídicos</p>
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
          <Link to="/auth">Área do cliente</Link>
        </Button>
        <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/auth?mode=signup">Adquirir</Link>
        </Button>
      </div>
    </div>
  </header>
);

export default Navbar;
