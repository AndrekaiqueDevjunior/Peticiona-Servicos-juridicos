import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const orders = [
  { id: "#1042", title: "Contestação trabalhista", status: "Em análise", date: "20/04/2026", category: "Defesas" },
  { id: "#1041", title: "Apelação cível", status: "Concluído", date: "19/04/2026", category: "Recursos" },
  { id: "#1038", title: "Petição inicial — Mandado de segurança", status: "Aguardando dados", date: "18/04/2026", category: "Petições iniciais" },
  { id: "#1035", title: "Embargos de declaração", status: "Concluído", date: "15/04/2026", category: "Recursos" },
  { id: "#1030", title: "Notificação extrajudicial", status: "Concluído", date: "10/04/2026", category: "Administrativo" },
];

const statusColor: Record<string, string> = {
  "Em análise": "bg-accent-soft text-primary",
  "Concluído": "bg-secondary text-foreground",
  "Aguardando dados": "bg-destructive/10 text-destructive",
};

const Orders = () => {
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
        <Button variant="outline" size="sm">
          Filtrar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {orders.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-secondary p-2">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{o.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.id} · {o.category} · {o.date}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${statusColor[o.status]}`}
                >
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Orders;
