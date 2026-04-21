import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export default function Account() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me.get(),
  });

  const [fullName, setFullName] = useState("");
  const [oabNumber, setOabNumber] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setOabNumber(user.oab_number ?? "");
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () => api.me.update({ full_name: fullName, oab_number: oabNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Dados atualizados com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Minha conta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie suas informações pessoais e preferências.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="oab">OAB (opcional)</Label>
              <Input
                id="oab"
                placeholder="UF 000000"
                value={oabNumber}
                onChange={(e) => setOabNumber(e.target.value)}
              />
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
          <div>
            <p className="font-medium text-foreground">Senha</p>
            <p className="text-sm text-muted-foreground">
              Altere sua senha de acesso.
            </p>
          </div>
          <Button variant="outline" disabled>
            Em breve
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
