import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  profileEditableSchema,
  updateEditableProfile,
  useClientProfile,
} from "@/lib/clientProfile";

export default function Account() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = useClientProfile();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me.get(),
  });

  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email || user?.email || "");
  const [errors, setErrors] = useState<{ phone?: string; email?: string }>({});

  // Sincroniza quando perfil/usuário carregam.
  useEffect(() => {
    if (profile.phone) setPhone(profile.phone);
    if (profile.email) setEmail(profile.email);
    else if (user?.email) setEmail(user.email);
  }, [profile.phone, profile.email, user?.email]);

  const mutation = useMutation({
    mutationFn: (payload: { email: string; phone: string }) => api.me.update(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      updateEditableProfile({ phone: updated.phone ?? "", email: updated.email });
      toast({ title: "Dados atualizados com sucesso." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar os dados",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = profileEditableSchema.safeParse({ phone, email });
    if (!result.success) {
      const fieldErrors: { phone?: string; email?: string } = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as "phone" | "email";
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
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
    mutation.mutate({ phone: result.data.phone, email: result.data.email });
  };

  // Dados imutáveis — fallback para o backend quando o perfil local não tem.
  const fullName = profile.fullName || user?.full_name || "";
  const cpf = profile.cpf || "";
  const oab = profile.oab
    ? profile.oabUf
      ? `${profile.oab}/${profile.oabUf}`
      : profile.oab
    : user?.oab_number || "";

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
            {/* Imutáveis */}
            <ReadonlyField
              label="Nome completo"
              value={fullName || "—"}
              hint="Somente leitura"
              className="sm:col-span-2"
            />
            <ReadonlyField label="CPF" value={cpf || "—"} hint="Somente leitura" />
            <ReadonlyField label="OAB / UF" value={oab || "—"} hint="Somente leitura" />

            {/* Editáveis */}
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
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
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
                maxLength={20}
                aria-invalid={!!errors.phone}
                required
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {mutation.isPending ? "Salvando..." : "Salvar alterações"}
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
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
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
      <Input value={value} disabled />
    </div>
  );
}
