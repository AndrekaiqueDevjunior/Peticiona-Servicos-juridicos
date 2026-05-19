import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const statusColor: Record<string, string> = {
  pendente: "bg-accent-soft text-primary",
  em_andamento: "bg-accent-soft text-primary",
  concluido: "bg-secondary text-foreground",
};

/** Saldo apresentado ao cliente: negativo vira R$ 0,00 (a divida ainda
 *  existe no backend e fica visivel para a equipe administrativa). */
const formatSaldoExibicao = (cents: number): string => {
  const safe = Math.max(0, cents);
  return (safe / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard.get(),
  });
  const { data: balance } = useQuery({
    queryKey: ["balance"],
    queryFn: () => api.me.balance(),
  });

  const stats = [
    {
      label: "Aguardando análise",
      value: data?.stats?.pendente ?? 0,
      icon: Clock,
      color: "text-accent",
    },
    {
      label: "Concluídos",
      value: data?.stats?.concluido ?? 0,
      icon: CheckCircle2,
      color: "text-primary",
    },
    {
      label: "Saldo Disponível",
      // Backend devolve credits_available em centavos e credits_available_brl
      // já formatado em R$. Saldo negativo é exibido como R$ 0,00 para o
      // cliente (decisão de UI) — o valor real continua acessível pelo admin
      // via /admin/financial e por /api/me/balance no campo cents.
      value: formatSaldoExibicao(balance?.credits_available_cents ?? balance?.credits_available ?? 0),
      icon: Wallet,
      color: "text-accent",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          {user?.full_name ? `Olá, ${user.full_name.split(" ")[0]}` : "Olá, bem-vindo"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui está um resumo da sua área do cliente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-secondary p-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <p className="text-2xl font-semibold text-foreground">{s.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl">Pedidos recentes</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/area-cliente/pedidos">Ver todos</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !data?.services.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido ainda. Crie sua primeira solicitação!
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.services.slice(0, 5).map((s) => (
                <li
                  key={s.reference}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-secondary p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.reference} · {s.deadline}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[s.status] ?? "bg-secondary text-foreground"}`}
                  >
                    {s.status_label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
