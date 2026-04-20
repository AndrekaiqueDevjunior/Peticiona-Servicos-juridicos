import { FileText, Clock, CheckCircle2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "Pedidos ativos", value: "3", icon: Clock, color: "text-accent" },
  { label: "Concluídos", value: "12", icon: CheckCircle2, color: "text-primary" },
  { label: "Saldo disponível", value: "5 créditos", icon: Wallet, color: "text-accent" },
];

const recent = [
  { id: "#1042", title: "Contestação trabalhista", status: "Em análise", date: "Hoje" },
  { id: "#1041", title: "Apelação cível", status: "Concluído", date: "Ontem" },
  { id: "#1038", title: "Petição inicial — MS", status: "Aguardando dados", date: "2 dias atrás" },
];

const Dashboard = () => {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Olá, bem-vindo
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
                <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl">Pedidos recentes</CardTitle>
          <Button variant="ghost" size="sm">
            Ver todos
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-secondary p-2">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.id} · {r.date}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-primary">
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
