import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const statusColor: Record<string, string> = {
  pendente: "bg-accent-soft text-primary",
  em_andamento: "bg-accent-soft text-primary",
  concluido: "bg-secondary text-foreground",
};

export default function Orders() {
  const { data, isLoading } = useQuery({
    queryKey: ["petitions"],
    queryFn: () => api.petitions.list(),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Meus pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe todas as suas solicitações jurídicas.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !data?.petitions.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido ainda. Use o botão "Novo pedido" para começar.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.petitions.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-secondary p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {p.tipo_peticao ? `${p.tipo_peticao} — ${p.area_direito}` : p.area_direito}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.reference}
                        {p.numero_processo ? ` · ${p.numero_processo}` : ""}
                        {" · "}
                        {p.created_at}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${statusColor[p.status] ?? "bg-secondary text-foreground"}`}
                  >
                    {p.status_label}
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
