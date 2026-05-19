import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyCreditsDialog } from "@/components/client/BuyCreditsDialog";
import { api } from "@/lib/api";

/** Saldo apresentado ao cliente: negativo vira R$ 0,00. A divida ainda
 *  existe no backend (credits_available_cents) e fica visivel ao admin. */
const formatSaldoExibicao = (cents: number | undefined): string => {
  const safe = Math.max(0, cents ?? 0);
  return (safe / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
};

export default function Balance() {
  const [openBuy, setOpenBuy] = useState(false);
  const { data: balance, isLoading } = useQuery({
    queryKey: ["balance"],
    queryFn: () => api.me.balance(),
  });

  const saldoExibido = formatSaldoExibicao(balance?.credits_available_cents);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meus Saldos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize seu saldo disponível e as movimentações registradas pela plataforma.
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
              Saldo Disponível
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-12 w-48 bg-white/20" />
            ) : (
              <p className="mt-3 font-display text-5xl font-semibold">
                {saldoExibido}
              </p>
            )}
            <p className="mt-1 text-sm opacity-80">
              Valor líquido disponível para novos pedidos.
            </p>
            <Button
              onClick={() => setOpenBuy(true)}
              className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="h-4 w-4" />
              Recarregar Saldo
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <SummaryRow
              label="Disponível"
              value={saldoExibido}
              isLoading={isLoading}
            />
            <SummaryRow
              label="Total creditado"
              value={balance?.credits_total_brl}
              isLoading={isLoading}
            />
            <SummaryRow
              label="Total utilizado"
              value={balance?.credits_used_brl}
              isLoading={isLoading}
            />
            <SummaryRow
              label="Movimentações"
              value={String(balance?.movements.length ?? 0)}
              isLoading={isLoading}
              bordered
            />
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
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-14 w-full" />
              ))}
            </div>
          ) : !balance?.movements.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma movimentação ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {balance.movements.map((movement, index) => (
                <li
                  key={`${movement.date}-${movement.description}-${index}`}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-md p-2 ${
                        movement.type === "in" ? "bg-accent/15" : "bg-secondary"
                      }`}
                    >
                      {movement.type === "in" ? (
                        <TrendingUp className="h-4 w-4 text-accent" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {movement.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(movement.date).toLocaleString("pt-BR")}
                        {movement.source ? ` · ${movement.source}` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      movement.type === "in" ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {movement.type === "in" ? "+" : "-"}
                    {movement.amount_brl}
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

function SummaryRow({
  label,
  value,
  isLoading,
  bordered = false,
}: {
  label: string;
  value?: string;
  isLoading: boolean;
  bordered?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bordered ? "border-t border-border pt-3" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      {isLoading ? <Skeleton className="h-4 w-16" /> : <span className="font-medium">{value}</span>}
    </div>
  );
}
