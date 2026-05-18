import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ApiError, api } from "@/lib/api";

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
};

export default function StaffProfile() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["staff-profile"],
    queryFn: () => api.staff.profile.get(),
  });

  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  useEffect(() => {
    if (!profile) return;
    setEmail(profile.email ?? "");
    setTelefone(profile.phone ?? "");
    setCep(profile.zip_code ?? "");
    setLogradouro(profile.street ?? "");
    setNumero(profile.street_number ?? "");
    setComplemento(profile.address_complement ?? "");
    setBairro(profile.neighborhood ?? "");
    setCidade(profile.city ?? "");
    setUf(profile.state ?? "");
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      api.staff.profile.update({
        email: email.trim() || null,
        phone: telefone.trim() || null,
        zip_code: cep.trim() || null,
        street: logradouro.trim() || null,
        street_number: numero.trim() || null,
        address_complement: complemento.trim() || null,
        neighborhood: bairro.trim() || null,
        city: cidade.trim() || null,
        state: uf.trim().toUpperCase() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-profile"] });
      toast({ title: "Dados atualizados com sucesso." });
    },
    onError: (err) => {
      const description =
        err instanceof ApiError ? err.message : "Tente novamente em instantes.";
      toast({
        title: "Erro ao salvar perfil",
        description,
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
          Você pode editar telefone, e-mail e endereço. Demais dados são somente leitura.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !profile ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full sm:col-span-2" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
              <ReadonlyInput
                label="Nome completo"
                value={profile.full_name || ""}
                className="sm:col-span-2"
              />
              <ReadonlyInput label="CPF" value={profile.cpf || "—"} />
              <ReadonlyInput
                label="Matrícula"
                value={profile.employee_code || "—"}
              />
              <ReadonlyInput label="OAB" value={profile.oab_number || "—"} />
              <ReadonlyInput
                label="Data de cadastro"
                value={formatDate(profile.created_at)}
              />

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2 mt-2">
                <h3 className="text-sm font-semibold text-foreground">Endereço</h3>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" value={cep} onChange={(e) => setCep(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uf">UF</Label>
                <Input
                  id="uf"
                  maxLength={2}
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                />
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          )}
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
