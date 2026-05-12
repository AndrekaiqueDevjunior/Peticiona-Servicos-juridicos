import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import logo from "@/assets/peticiona-logo.png";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.auth.requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setErrorMsg("O backend ainda não habilitou a recuperação de senha nesta instalação.");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Não foi possível solicitar a redefinição.");
      }
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
                {submitted ? "Verifique seu e-mail" : "Recuperar senha"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {submitted
                  ? "Se este e-mail estiver cadastrado, enviamos um link para redefinir sua senha."
                  : "Informe o e-mail cadastrado para receber o link de redefinição."}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
              {submitted ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <p className="text-sm text-foreground">
                    Enviamos um e-mail para{" "}
                    <span className="font-medium">{email}</span> com as instruções
                    para criar uma nova senha.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Não recebeu? Verifique a pasta de spam ou tente novamente em
                    alguns minutos.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="mt-2 w-full"
                  >
                    <Link to="/auth">Voltar ao login</Link>
                  </Button>
                </div>
              ) : (
                <form className="grid gap-4" onSubmit={handleSubmit}>
                  {errorMsg && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {errorMsg}
                    </p>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="email">E-mail cadastrado</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="voce@exemplo.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={255}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !email}
                    className="mt-2 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {loading ? "Enviando..." : "Enviar link de redefinição"}
                  </Button>
                </form>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Por segurança, só enviamos e-mails para contas previamente cadastradas.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ForgotPassword;
