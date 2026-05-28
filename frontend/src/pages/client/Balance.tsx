import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyCreditsDialog } from "@/components/client/BuyCreditsDialog";
import { api } from "@/lib/api";
import { CREDIT_KIND_LABEL, type CreditKind } from "@/lib/balance";
import { cn } from "@/lib/utils";

const CREDIT_KINDS: { kind: CreditKind; color: string; icon: React.ComponentType<any> }[] = [
  { kind: "common", color: "bg-blue-50 dark:bg-blue-950/20", icon: Wallet },
];

export default function Balance() {
  const [openBuy, setOpenBuy] = useState(false);
  const { data: balance, isLoading } = useQuery({
    queryKey: ["balance"],
    queryFn: () => api.me.balance(),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meus Créditos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize seus créditos disponíveis e as movimentações registradas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-1 max-w-sm">
        {CREDIT_KINDS.map(({ kind, color, icon: Icon }) => (
          <Card key={kind} className={cn("overflow-hidden", color)}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4" />
                {CREDIT_KIND_LABEL[kind]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div>
                  <p className="font-display text-3xl font-semibold">
                    {balance?.balances[kind] ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {balance?.balances[kind] === 1 ? "crédito" : "créditos"}
                  </p>
                </div>
              )}
              <div className="border-t border-border/20 pt-2 text-xs text-muted-foreground">
                {isLoading ? (
                  <Skeleton className="h-4 w-full" />
                ) : (
                  <>
                    <p>
                      Entrada: {balance?.totals_by_kind?.[kind]?.credits_in ?? 0}{" "}
                      {balance?.totals_by_kind?.[kind]?.credits_in === 1 ? "crédito" : "créditos"}
                    </p>
                    <p>
                      Saída: {balance?.totals_by_kind?.[kind]?.credits_out ?? 0}{" "}
                      {balance?.totals_by_kind?.[kind]?.credits_out === 1 ? "crédito" : "créditos"}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ações Rápidas</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setOpenBuy(true)}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Comprar Créditos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Extrato Completo</CardTitle>
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
                  <div className="flex items-center gap-3 flex-1">
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {movement.description}
                        </p>
                        <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {movement.kind === "legacy_cents"
                            ? "Histórico"
                            : CREDIT_KIND_LABEL[movement.kind as CreditKind]}
                        </span>
                      </div>
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
                    {movement.amount_brl ?? movement.amount}
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

