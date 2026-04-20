import { Wallet, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const movements = [
  { type: "in", desc: "Compra de pacote — 10 créditos", date: "15/04/2026", value: "+10" },
  { type: "out", desc: "Petição inicial — #1038", date: "18/04/2026", value: "-2" },
  { type: "out", desc: "Contestação — #1042", date: "20/04/2026", value: "-3" },
];

const Balance = () => {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meus saldos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize seus créditos e movimentações.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 overflow-hidden">
          <div
            className="relative p-6 text-primary-foreground"
            style={{ background: "var(--gradient-hero)" }}
          >
            <div className="flex items-center gap-2 text-sm opacity-80">
              <Wallet className="h-4 w-4" />
              Saldo disponível
            </div>
            <p className="mt-3 font-display text-5xl font-semibold">5</p>
            <p className="mt-1 text-sm opacity-80">créditos para uso</p>
            <Button className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4" />
              Comprar mais créditos
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adquiridos</span>
              <span className="font-medium">10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilizados</span>
              <span className="font-medium">5</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <span className="text-muted-foreground">Disponíveis</span>
              <span className="font-semibold text-primary">5</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Movimentações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {movements.map((m, i) => (
              <li key={i} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-md p-2 ${m.type === "in" ? "bg-accent-soft" : "bg-secondary"}`}
                  >
                    {m.type === "in" ? (
                      <TrendingUp className="h-4 w-4 text-accent" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.desc}</p>
                    <p className="text-xs text-muted-foreground">{m.date}</p>
                  </div>
                </div>
                <span
                  className={`font-semibold ${m.type === "in" ? "text-accent" : "text-foreground"}`}
                >
                  {m.value}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Balance;
