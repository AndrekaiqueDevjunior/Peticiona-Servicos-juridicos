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

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Segurança</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-2">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Senha</p>
              <p className="text-sm text-muted-foreground">
                Altere sua senha de acesso.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled>
            Em breve
          </Button>
        </CardContent>
      </Card>
    </div>
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
