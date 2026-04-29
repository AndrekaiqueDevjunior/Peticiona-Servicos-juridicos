import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyCreditsDialog } from "@/components/client/BuyCreditsDialog";
import { api } from "@/lib/api";
import { formatBRL } from "@/lib/format";

export default function Balance() {
  const [openBuy, setOpenBuy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["me-balance"],
    queryFn: () => api.me.balance(),
    staleTime: 30_000,
  });

  const saldoDisponivel = data?.credits_available_cents ?? 0;
  const saldoTotal = data?.credits_total_cents ?? 0;
  const saldoUsado = data?.credits_used_cents ?? 0;
  const movements = data?.movements ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meus saldos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize seu saldo em reais e movimentações.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden md:col-span-2">
          <div
            className="relative p-6 text-primary-foreground"
            style={{ background: "var(--gradient-hero)" }}
          >
            <div className="flex items-center gap-2 text-sm opacity-80">
              <Wallet className="h-4 w-4" />
              Saldo disponível
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-12 w-40 bg-white/20" />
            ) : (
              <p className="mt-3 font-display text-5xl font-semibold">
                {data?.credits_available_brl ?? formatBRL(saldoDisponivel / 100)}
              </p>
            )}
            <p className="mt-1 text-sm opacity-80">
              Debitado automaticamente a cada pedido finalizado.
            </p>
            <Button
              onClick={() => setOpenBuy(true)}
              className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90"
            >
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
              <span className="text-muted-foreground">Total creditado</span>
              <span className="font-medium">
                {data?.credits_total_brl ?? formatBRL(saldoTotal / 100)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilizado</span>
              <span className="font-medium">
                {data?.credits_used_brl ?? formatBRL(saldoUsado / 100)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <span className="text-muted-foreground">Disponível</span>
              <span className="font-semibold text-primary">
                {data?.credits_available_brl ?? formatBRL(saldoDisponivel / 100)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Movimentações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : movements.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma movimentação ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {movements.map((m, i) => (
                <li key={i} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-md p-2 ${m.type === "in" ? "bg-accent/15" : "bg-secondary"}`}>
                      {m.type === "in" ? (
                        <TrendingUp className="h-4 w-4 text-accent" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.date).toLocaleString("pt-BR")}
                        {m.source ? ` · ${labelSource(m.source)}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${m.type === "in" ? "text-accent" : "text-foreground"}`}>
                    {m.type === "in" ? "+" : "-"}
                    {m.amount_brl ?? formatBRL((m.amount_cents ?? m.amount ?? 0) / 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <BuyCreditsDialog open={openBuy} onOpenChange={setOpenBuy} />
    </div>
  );
}

const labelSource = (s: string) => {
  if (s === "plano") return "saldo do plano";
  if (s === "avulso") return "saldo avulso";
  return "plano + avulso";
};
