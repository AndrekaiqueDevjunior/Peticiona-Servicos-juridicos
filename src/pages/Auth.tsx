import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/peticiona-logo.png";

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5 6.7 2.5 2.4 6.8 2.4 12.1S6.7 21.7 12 21.7c6.9 0 11.5-4.9 11.5-11.7 0-.8-.1-1.4-.2-2L12 10.2z" />
  </svg>
);

const AppleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M16.365 1.43c0 1.14-.43 2.23-1.13 3.04-.76.86-1.96 1.52-3.05 1.43-.13-1.1.42-2.27 1.1-3.03.76-.85 2.05-1.5 3.08-1.44zM21 17.4c-.55 1.27-.81 1.83-1.51 2.95-.97 1.55-2.34 3.49-4.04 3.5-1.51.02-1.9-.99-3.95-.98-2.05.01-2.48.99-3.99.98-1.7-.02-3-1.77-3.97-3.32C.86 15.84.42 9.93 3.18 6.78c1.16-1.34 2.99-2.18 4.71-2.18 1.75 0 2.86 1 4.31 1 1.41 0 2.27-1 4.29-1 1.53 0 3.16.84 4.31 2.28-3.79 2.08-3.17 7.5-.79 10.52z" />
  </svg>
);

const Auth = () => {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(
    params.get("mode") === "signup" ? "signup" : "login"
  );

  const isSignup = mode === "signup";

  return (
    <div className="relative min-h-screen bg-background">
      {/* Decorative background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{ background: "var(--gradient-hero)", opacity: 0.08 }}
        aria-hidden="true"
      />

      <div className="container relative flex min-h-screen flex-col">
        {/* Top bar */}
        <div className="flex h-16 items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
        </div>

        {/* Card */}
        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center text-center">
              <img src={logo} alt="Peticiona" className="h-14 w-14 object-contain" />
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-primary">
                {isSignup ? "Criar conta" : "Bem-vindo de volta"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {isSignup
                  ? "Cadastre-se para acessar sua área do cliente"
                  : "Acesse sua área do cliente Peticiona"}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
              {/* Social */}
              <div className="grid gap-2">
                <Button variant="outline" className="w-full" type="button">
                  <GoogleIcon />
                  Continuar com Google
                </Button>
                <Button variant="outline" className="w-full" type="button">
                  <AppleIcon />
                  Continuar com Apple
                </Button>
              </div>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  ou
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Form */}
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                {isSignup && (
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="name" placeholder="Seu nome" className="pl-9" />
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="voce@exemplo.com"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    {!isSignup && (
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-9"
                    />
                  </div>
                </div>

                <Button
                  asChild
                  type="submit"
                  className="mt-2 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Link to="/area-cliente">
                    {isSignup ? "Criar conta" : "Entrar"}
                  </Link>
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isSignup ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode(isSignup ? "login" : "signup")}
                  className="font-medium text-primary hover:underline"
                >
                  {isSignup ? "Entrar" : "Criar agora"}
                </button>
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Ao continuar, você concorda com nossos Termos e Política de Privacidade.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Auth;
