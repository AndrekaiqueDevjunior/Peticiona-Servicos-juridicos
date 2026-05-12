import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { profileEditableSchema } from "@/lib/clientProfile";

export default function Account() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me.get(),
  });

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhone(user?.phone ?? "");
    setEmail(user?.email ?? "");
  }, [user?.phone, user?.email]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = profileEditableSchema.safeParse({ phone, email });
    if (!result.success) {
      const fieldErrors: { phone?: string; email?: string } = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as "phone" | "email";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast({
        title: "Verifique os campos",
        description: "Corrija os erros destacados.",
        variant: "destructive",
      });
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const updated = await api.me.update({
        email: result.data.email,
        phone: result.data.phone,
      });
      queryClient.setQueryData(["me"], updated);
      toast({ title: "Dados atualizados com sucesso." });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const oab = user?.oab_number ?? "";
  const cpf = user?.cpf ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Minha conta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você pode alterar telefone e e-mail. Para corrigir nome, CPF ou OAB,
          entre em contato com nossa equipe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <ReadonlyField
              label="Nome completo"
              value={user?.full_name ?? ""}
              hint="Somente leitura"
              className="sm:col-span-2"
              isLoading={isLoading}
            />
            <ReadonlyField
              label="CPF"
              value={cpf}
              hint="Somente leitura"
              isLoading={isLoading}
            />
            <ReadonlyField
              label="OAB / UF"
              value={oab}
              hint="Somente leitura"
              isLoading={isLoading}
            />

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="email">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                aria-invalid={!!errors.email}
                required
                disabled={isLoading || saving}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="phone">
                Telefone / WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                aria-invalid={!!errors.phone}
                required
                disabled={isLoading || saving}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            <div className="flex justify-end sm:col-span-2">
              <Button
                type="submit"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={isLoading || saving}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <PasswordSection />
    </div>
  );
}

function PasswordSection() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword) {
      setError("Preencha a senha atual e a nova senha.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Confirmação não confere com a nova senha.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("A nova senha deve ser diferente da atual.");
      return;
    }

    setSubmitting(true);
    try {
      await api.me.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Senha alterada",
        description: "Sua senha foi atualizada com sucesso.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      setError(msg);
      toast({
        title: "Não foi possível alterar a senha",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Segurança</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-md bg-secondary p-2">
            <Lock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">Senha</p>
            <p className="text-sm text-muted-foreground">
              Altere sua senha de acesso. Mínimo de 8 caracteres.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              maxLength={100}
              required
              disabled={submitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              maxLength={100}
              required
              disabled={submitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              maxLength={100}
              required
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}

          <div className="flex justify-end sm:col-span-2">
            <Button
              type="submit"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={submitting}
            >
              {submitting ? "Salvando..." : "Atualizar senha"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ReadonlyField({
  label,
  value,
  hint,
  className,
  isLoading,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
  isLoading?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground">{label}</Label>
        {hint && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {isLoading ? <Skeleton className="h-10 w-full" /> : <Input value={value || "—"} disabled />}
    </div>
  );
}
