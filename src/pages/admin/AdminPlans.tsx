import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PRECO_PLANO,
  PRECO_AVULSO_GRUPO_A,
  PRECO_AVULSO_GRUPO_B,
  PRECO_PETICAO_EXPRESS,
  PRECO_RECURSO_EXPRESS,
  formatBRL,
} from "@/lib/pricing";

export default function AdminPlans() {
  const planos = [
    { key: "essencial", label: "Plano Essencial", preco: PRECO_PLANO.essencial },
    { key: "profissional", label: "Plano Profissional", preco: PRECO_PLANO.profissional },
    { key: "estrategico", label: "Plano Estratégico", preco: PRECO_PLANO.estrategico },
  ];

  const avulsos = [
    { label: "Petição Avulsa (Grupo A)", preco: PRECO_AVULSO_GRUPO_A },
    { label: "Recurso Avulso (Grupo B)", preco: PRECO_AVULSO_GRUPO_B },
    { label: "Petição Express", preco: PRECO_PETICAO_EXPRESS },
    { label: "Recurso Express", preco: PRECO_RECURSO_EXPRESS },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Planos e preços
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize os valores praticados na plataforma. Edição em breve.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Planos mensais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {planos.map((p) => (
            <div key={p.key} className="grid gap-2">
              <Label className="text-muted-foreground">{p.label}</Label>
              <Input value={formatBRL(p.preco)} disabled />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Serviços avulsos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {avulsos.map((a) => (
            <div key={a.label} className="grid gap-2">
              <Label className="text-muted-foreground">{a.label}</Label>
              <Input value={formatBRL(a.preco)} disabled />
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Edição de valores estará disponível em uma próxima atualização.
      </p>
    </div>
  );
}
