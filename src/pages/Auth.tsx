import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Briefcase, IdCard, Lock, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { profileSignupSchema, setProfileOnSignup } from "@/lib/clientProfile";
import logo from "@/assets/peticiona-logo.png";

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "signup">(
    params.get("mode") === "signup" ? "signup" : "login"
  );
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    oab_number: "",
    phone: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        if (form.password !== form.confirm_password) {
          toast({ title: "Senhas não conferem", variant: "destructive" });
          return;
        }
        const validated = profileSignupSchema.safeParse({
          fullName: form.full_name,
          cpf: form.cpf,
          oab: form.oab_number,
          phone: form.phone,
          email: form.email,
        });
        if (!validated.success) {
          toast({
            title: "Verifique os campos",
            description: validated.error.issues[0]?.message ?? "Dados inválidos.",
            variant: "destructive",
          });
          return;
        }
        await register({
          full_name: form.full_name,
          email: form.email,
          oab_number: form.oab_number,
          password: form.password,
          confirm_password: form.confirm_password,
        });
        setProfileOnSignup({
          fullName: validated.data.fullName,
          cpf: validated.data.cpf,
          oab: validated.data.oab,
          phone: validated.data.phone,
          email: validated.data.email,
        });
      } else {
        await login(form.email, form.password);
      }
      navigate("/area-cliente");
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
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
        <div className="flex h-16 items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
        </div>

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
              <form className="grid gap-4" onSubmit={handleSubmit}>
                {isSignup && (
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome completo *</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="Seu nome completo"
                        className="pl-9"
                        value={form.full_name}
                        onChange={set("full_name")}
                        maxLength={120}
                        required
                      />
                    </div>
                  </div>
                )}

                {isSignup && (
                  <div className="grid gap-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <div className="relative">
                      <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="cpf"
                        placeholder="000.000.000-00"
                        className="pl-9"
                        value={form.cpf}
                        onChange={set("cpf")}
                        maxLength={14}
                        required
                      />
                    </div>
                  </div>
                )}

                {isSignup && (
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phone"
                        inputMode="tel"
                        placeholder="(11) 91234-5678"
                        className="pl-9"
                        value={form.phone}
                        onChange={set("phone")}
                        maxLength={20}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail{isSignup && " *"}</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="voce@exemplo.com"
                      className="pl-9"
                      value={form.email}
                      onChange={set("email")}
                      maxLength={255}
                      required
                    />
                  </div>
                </div>

                {isSignup && (
                  <div className="grid gap-2">
                    <Label htmlFor="oab">OAB / UF *</Label>
                    <div className="relative">
                      <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="oab"
                        placeholder="SP 123456"
                        className="pl-9"
                        value={form.oab_number}
                        onChange={set("oab_number")}
                        maxLength={20}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    {!isSignup && (
                      <button type="button" className="text-xs text-accent hover:underline">
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
                      value={form.password}
                      onChange={set("password")}
                      required
                    />
                  </div>
                </div>

                {isSignup && (
                  <div className="grid gap-2">
                    <Label htmlFor="confirm_password">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm_password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-9"
                        value={form.confirm_password}
                        onChange={set("confirm_password")}
                        required
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {loading ? "Aguarde..." : isSignup ? "Criar conta" : "Entrar"}
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
