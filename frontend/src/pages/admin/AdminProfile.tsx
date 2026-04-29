import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const notProvided = "Não informado";

export default function AdminProfile() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["admin", "profile"],
    queryFn: () => api.admin.profile(),
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [oabNumber, setOabNumber] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setEmail(profile.email ?? "");
    setOabNumber(profile.oab_number ?? "");
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      api.admin.updateProfile({
        full_name: fullName,
        email,
        oab_number: oabNumber || null,
      }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(["admin", "profile"], updatedProfile);
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
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meu perfil
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você pode editar nome, e-mail e OAB. Dados adicionais estarão disponíveis em breve.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="full-name">Nome completo</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading || mutation.isPending}
              />
            </div>

            <ReadonlyInput label="Cargo" value="Administrador" />
            <ReadonlyInput label="Data de cadastro" value={profile?.created_at_label ?? "—"} />

            <div className="grid gap-2">
              <Label htmlFor="oab-number">OAB</Label>
              <Input
                id="oab-number"
                value={oabNumber}
                onChange={(e) => setOabNumber(e.target.value)}
                placeholder={notProvided}
                disabled={isLoading || mutation.isPending}
              />
            </div>

            <ReadonlyInput label="Status" value={profile?.is_active ? "Ativo" : "Inativo"} />

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || mutation.isPending}
              />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button
                type="submit"
                disabled={isLoading || mutation.isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {mutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadonlyInput({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value} disabled />
    </div>
  );
}
