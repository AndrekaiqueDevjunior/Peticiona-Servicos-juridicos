import { useState } from "react";
import { Check, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/pricing";
import {
  AVULSOS_INFO,
  PLANOS_INFO,
  assinarPlano,
  comprarCreditoAvulso,
  type CreditoAvulsoTipo,
} from "@/lib/balance";

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BuyCreditsDialog = ({ open, onOpenChange }: BuyCreditsDialogProps) => {
  const [processing, setProcessing] = useState<string | null>(null);

  const handleAssinar = async (id: typeof PLANOS_INFO[number]["id"]) => {
    setProcessing(id);
    // TODO: integrar pagar.me. Por enquanto simulamos confirmação imediata.
    await new Promise((r) => setTimeout(r, 400));
    assinarPlano(id);
    setProcessing(null);
    toast({
      title: "Plano ativado",
      description: "Seu saldo foi creditado na conta.",
    });
    onOpenChange(false);
  };

  const handleComprarAvulso = async (id: CreditoAvulsoTipo) => {
    setProcessing(id);
    await new Promise((r) => setTimeout(r, 400));
    comprarCreditoAvulso(id);
    setProcessing(null);
    toast({
      title: "Crédito adicionado",
      description: "Seu saldo foi atualizado.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comprar créditos</DialogTitle>
          <DialogDescription>
            Escolha um plano mensal ou compre créditos avulsos. Pagamento via
            pagar.me — após confirmação, seu saldo é creditado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="planos" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planos">
              <Sparkles className="mr-2 h-4 w-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="avulsos">
              <Zap className="mr-2 h-4 w-4" />
              Créditos avulsos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planos" className="mt-4 grid gap-4 md:grid-cols-3">
            {PLANOS_INFO.map((p) => (
              <div
                key={p.id}
                className="flex flex-col rounded-lg border border-border bg-card p-5"
              >
                <h4 className="font-display text-lg font-semibold text-foreground">
                  {p.nome}
                </h4>
                <p className="mt-1 font-display text-2xl font-semibold text-primary">
                  {formatBRL(p.valor)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    Saldo de {formatBRL(p.valor)} mensais
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {formatBRL(p.porPedido)} por pedido (qualquer tipo)
                  </li>
                </ul>
                <Button
                  type="button"
                  className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => handleAssinar(p.id)}
                  disabled={processing !== null}
                >
                  {processing === p.id ? "Processando..." : "Assinar"}
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="avulsos" className="mt-4 grid gap-4 sm:grid-cols-2">
            {AVULSOS_INFO.map((a) => (
              <div
                key={a.id}
                className="flex flex-col rounded-lg border border-border bg-card p-4"
              >
                <h4 className="font-medium text-foreground">{a.nome}</h4>
                <p className="mt-1 font-display text-xl font-semibold text-primary">
                  {formatBRL(a.valor)}
                </p>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">
                  {a.descricao}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => handleComprarAvulso(a.id)}
                  disabled={processing !== null}
                >
                  {processing === a.id ? "Processando..." : "Comprar"}
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
