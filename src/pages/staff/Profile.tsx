import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function StaffProfile() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["staff", "profile"],
    queryFn: () => api.staff.profile(),
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    zip_code: "",
    street: "",
    street_number: "",
    address_complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? "",
      zip_code: data.zip_code ?? "",
      street: data.street ?? "",
      street_number: data.street_number ?? "",
      address_complement: data.address_complement ?? "",
      neighborhood: data.neighborhood ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.staff.updateProfile(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "profile"] });
      toast({ title: "Perfil atualizado." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar o perfil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meu perfil
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados reais do funcionário, salvos no backend.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando perfil...</p>
          ) : (
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="staff-name">Nome completo</Label>
                <Input
                  id="staff-name"
                  value={form.full_name}
                  onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))}
                />
              </div>
              <ReadonlyInput label="CPF" value={data?.cpf ?? "—"} />
              <ReadonlyInput label="Matrícula" value={data?.employee_code ?? "—"} />
              <ReadonlyInput label="Cargo" value={data?.role_title ?? "—"} />
              <ReadonlyInput label="OAB" value={data?.oab_number ?? "—"} />

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="staff-email">E-mail</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="staff-phone">Telefone</Label>
                <Input
                  id="staff-phone"
                  value={form.phone}
                  onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2 mt-2">
                <h3 className="text-sm font-semibold text-foreground">Endereço</h3>
              </div>
              {[
                ["CEP", "zip_code"],
                ["Logradouro", "street"],
                ["Número", "street_number"],
                ["Complemento", "address_complement"],
                ["Bairro", "neighborhood"],
                ["Cidade", "city"],
                ["UF", "state"],
              ].map(([label, key]) => (
                <div className="grid gap-2" key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
                  />
                </div>
              ))}

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReadonlyInput({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value} disabled />
    </div>
  );
}
