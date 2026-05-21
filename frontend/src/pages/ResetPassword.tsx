import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import logo from "@/assets/peticiona-logo.png";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  // Espelha app.core.password.validate_password_strength no backend.
  // Mín 10 chars + mai/min/num/símbolo. Backend ainda valida blocklist
  // de senhas comuns e similaridade com e-mail (não duplicamos aqui pra
  // não sincronizar a lista; backend é a fonte da verdade).
  const checks = useMemo(
    () => ({
      length: password.length >= 10,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );
  const valid = Object.values(checks).every(Boolean);
  const matches = password.length > 0 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !matches || !token) return;
    setLoading(true);
    try {
      await api.auth.confirmPasswordReset(token, password);
      toast({
        title: "Senha redefinida",
        description: "Você já pode entrar com a nova senha.",
      });
      navigate("/auth");
    } catch (err: unknown) {
      const description =
        err instanceof ApiError && err.status === 404
          ? "O backend ainda não habilitou a confirmação de redefinição de senha."
          : err instanceof Error
            ? err.message
            : "Tente novamente.";
      toast({
        title: "Não foi possível redefinir a senha",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="container relative flex min-h-screen flex-col">
        <div className="flex h-16 items-center">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </div>

        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center text-center">
              <img src={logo} alt="Peticiona" className="h-14 w-14 object-contain" />
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-primary">
                Criar nova senha
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Defina uma nova senha para acessar sua conta.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
              {!token && (
                <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                  Link de redefinição inválido ou expirado. Solicite um novo em
                  "Esqueci minha senha".
                </p>
              )}

              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirm">Confirmar nova senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm"
                      type={show ? "text" : "password"}
                      className="pl-9"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                  {confirm.length > 0 && !matches && (
                    <p className="text-xs text-destructive">As senhas não conferem.</p>
                  )}
                </div>

                {password.length > 0 && (
                  <ul className="grid gap-1 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                    {[
                      { ok: checks.length, label: "Mínimo 10 caracteres" },
                      { ok: checks.upper, label: "1 letra maiúscula" },
                      { ok: checks.lower, label: "1 letra minúscula" },
                      { ok: checks.number, label: "1 número" },
                      { ok: checks.symbol, label: "1 símbolo" },
                    ].map((c) => (
                      <li key={c.label} className="flex items-center gap-2">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-sm ${
                            c.ok ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        </span>
                        <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>
                          {c.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  type="submit"
                  disabled={loading || !valid || !matches || !token}
                  className="mt-2 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {loading ? "Salvando..." : "Redefinir senha"}
                </Button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResetPassword;
