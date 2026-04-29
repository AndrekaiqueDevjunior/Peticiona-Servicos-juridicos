import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, IdCard, Lock, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  BRAZILIAN_UF_OPTIONS,
  profileSignupSchema,
} from "@/lib/profileSchemas";
import { isValidCPF, maskCPF, maskOAB, maskPhone } from "@/lib/masks";
import logo from "@/assets/peticiona-logo.png";

interface FormState {
  full_name: string;
  phone: string;
  email: string;
  cpf: string;
  oab: string;
  oab_uf: string;
  password: string;
  confirm_password: string;
}

const initial: FormState = {
  full_name: "",
  phone: "",
  email: "",
  cpf: "",
  oab: "",
  oab_uf: "",
  password: "",
  confirm_password: "",
};

const Signup = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);

  const update = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};

    const parsed = profileSignupSchema.safeParse({
      fullName: form.full_name,
      cpf: form.cpf,
      oab: form.oab,
      oabUf: form.oab_uf,
      phone: form.phone,
      email: form.email,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const map: Record<string, keyof FormState> = {
          fullName: "full_name",
          cpf: "cpf",
          oab: "oab",
          oabUf: "oab_uf",
          phone: "phone",
          email: "email",
        };
        const key = map[issue.path[0] as string];
        if (key && !next[key]) next[key] = issue.message;
      }
    }
    if (form.cpf && !next.cpf && !isValidCPF(form.cpf)) {
      next.cpf = "CPF inválido.";
    }
    if (!form.password || form.password.length < 6) {
      next.password = "Senha deve ter pelo menos 6 caracteres.";
    }
    if (form.password !== form.confirm_password) {
      next.confirm_password = "As senhas não conferem.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        oab_number: `${form.oab}/${form.oab_uf}`,
        cpf: form.cpf,
        phone: form.phone,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      navigate("/area-cliente");
    } catch (err: unknown) {
      toast({
        title: "Erro ao criar conta",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (field: keyof FormState) =>
    `pl-9 ${errors[field] ? "border-destructive focus-visible:ring-destructive" : ""}`;

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
          <div className="w-full max-w-lg">
            <div className="mb-8 flex flex-col items-center text-center">
              <img src={logo} alt="Peticiona" className="h-14 w-14 object-contain" />
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-primary">
                Criar conta
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Preencha seus dados para acessar a área do cliente.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
              <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-1.5">
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="full_name"
                      placeholder="Seu nome completo"
                      className={fieldClass("full_name")}
                      value={form.full_name}
                      onChange={(e) => update("full_name", e.target.value)}
                      maxLength={120}
                    />
                  </div>
                  {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      inputMode="tel"
                      placeholder="(11) 91234-5678"
                      className={fieldClass("phone")}
                      value={form.phone}
                      onChange={(e) => update("phone", maskPhone(e.target.value))}
                      maxLength={20}
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="email">E-mail *</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="voce@exemplo.com"
                      className={fieldClass("email")}
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      maxLength={255}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="cpf">CPF *</Label>
                    <div className="relative">
                      <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="cpf"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        className={fieldClass("cpf")}
                        value={form.cpf}
                        onChange={(e) => update("cpf", maskCPF(e.target.value))}
                        maxLength={14}
                      />
                    </div>
                    {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
                  </div>

                  <div className="grid gap-1.5">
                    <Label>OAB / UF *</Label>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px]">
                      <div className="relative">
                        <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="oab"
                          inputMode="numeric"
                          placeholder="Número da OAB"
                          className={fieldClass("oab")}
                          value={form.oab}
                          onChange={(e) => update("oab", maskOAB(e.target.value))}
                          maxLength={10}
                        />
                      </div>

                      <Select value={form.oab_uf} onValueChange={(value) => update("oab_uf", value)}>
                        <SelectTrigger
                          id="oab_uf"
                          className={errors.oab_uf ? "border-destructive focus:ring-destructive" : undefined}
                          aria-invalid={!!errors.oab_uf}
                        >
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZILIAN_UF_OPTIONS.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(errors.oab || errors.oab_uf) && (
                      <p className="text-xs text-destructive">{errors.oab || errors.oab_uf}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="password">Senha *</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className={fieldClass("password")}
                        value={form.password}
                        onChange={(e) => update("password", e.target.value)}
                      />
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="confirm_password">Confirmar senha *</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm_password"
                        type="password"
                        placeholder="••••••••"
                        className={fieldClass("confirm_password")}
                        value={form.confirm_password}
                        onChange={(e) => update("confirm_password", e.target.value)}
                      />
                    </div>
                    {errors.confirm_password && (
                      <p className="text-xs text-destructive">{errors.confirm_password}</p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {loading ? "Criando..." : "Criar conta"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link to="/auth" className="font-medium text-primary hover:underline">
                  Entrar
                </Link>
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

export default Signup;
