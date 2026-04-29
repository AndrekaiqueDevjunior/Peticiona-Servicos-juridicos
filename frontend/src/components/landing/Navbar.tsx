import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import logo from "@/assets/peticiona-logo.png";

const links = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
  { href: "#contato", label: "Contato" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Peticiona — início">
          <img src={logo} alt="Peticiona Serviços Jurídicos" className="h-9 w-9 object-contain" />
          <div className="leading-none">
            <p className="font-display text-lg font-semibold tracking-tight text-primary">PETICIONA</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Serviços Jurídicos</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Área do cliente</Link>
          </Button>
          <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/auth?mode=signup">Adquirir</Link>
          </Button>
        </div>

        {/* Mobile trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[80%] max-w-xs p-0">
            <div className="flex h-16 items-center justify-between border-b border-border/60 px-5">
              <div className="flex items-center gap-2">
                <img src={logo} alt="" className="h-7 w-7 object-contain" />
                <p className="font-display text-base font-semibold tracking-tight text-primary">PETICIONA</p>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Fechar menu">
                  <X className="h-5 w-5" />
                </Button>
              </SheetClose>
            </div>

            <nav className="flex flex-col gap-1 px-3 py-4">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  {l.label}
                </a>
              ))}
            </nav>

            <div className="mt-2 flex flex-col gap-2 border-t border-border/60 px-5 py-5">
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link to="/auth">Área do cliente</Link>
              </Button>
              <Button
                asChild
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => setOpen(false)}
              >
                <Link to="/auth?mode=signup">Adquirir</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Navbar;
