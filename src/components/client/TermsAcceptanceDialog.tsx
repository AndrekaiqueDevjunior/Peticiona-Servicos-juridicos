import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { acceptTerms } from "@/lib/terms";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
}

const TERMS_TEXT = `TERMOS DE USO E POLÍTICA DE CANCELAMENTO — PETICIONA SERVIÇOS JURÍDICOS

1. OBJETO
A PETICIONA SERVIÇOS JURÍDICOS ("PETICIONA") oferece a profissionais da advocacia serviços de elaboração de peças jurídicas (petições, recursos e documentos correlatos) sob demanda, mediante créditos pré-pagos ou planos de assinatura.

2. NATUREZA DO SERVIÇO
A PETICIONA atua como prestadora de serviços técnicos de redação jurídica de apoio. A revisão final, a estratégia processual e o protocolo das peças são de responsabilidade exclusiva do(a) advogado(a) contratante.

3. CADASTRO E CONTA
3.1 O cadastro exige dados verídicos: nome completo, CPF, OAB/UF, telefone e e-mail.
3.2 Após o cadastro, nome, CPF e OAB/UF não poderão ser alterados pelo cliente — apenas pela equipe interna mediante comprovação.
3.3 É vedado o compartilhamento de credenciais.

4. PRAZOS DE ENTREGA
4.1 Os prazos de entrega variam conforme o plano/modalidade contratada e começam a contar a partir da CONFIRMAÇÃO DO PAGAMENTO.
4.2 Modalidades padrão: 2 a 3 dias úteis (conforme plano). Modalidades Express: 24 horas corridas.
4.3 Atrasos atribuíveis a pendências de informação por parte do cliente suspendem a contagem.

5. PAGAMENTOS, CRÉDITOS E PLANOS
5.1 Os créditos podem ser provenientes de plano ativo ou compra avulsa. O sistema debita prioritariamente o saldo do plano ativo.
5.2 Os créditos do plano são renovados na data de vigência. Créditos avulsos não expiram, salvo disposição em contrário.

6. POLÍTICA DE CANCELAMENTO E ARREPENDIMENTO
6.1 O cliente poderá cancelar pedidos APENAS antes do início da execução pela equipe da PETICIONA.
6.2 Iniciada a execução e/ou entregue a peça, NÃO HAVERÁ direito de arrependimento ou reembolso, nos termos do art. 49, §3º, do Código de Defesa do Consumidor, dada a natureza personalíssima e sob medida do serviço.
6.3 O cancelamento de planos de assinatura segue a regra de vigência mensal, sem reembolso proporcional dos créditos já consumidos.

7. PROPRIEDADE INTELECTUAL
As peças entregues poderão ser livremente utilizadas pelo(a) advogado(a) contratante em seus processos, sendo vedada a revenda, a redistribuição comercial ou a divulgação como produto próprio para terceiros.

8. CONFIDENCIALIDADE E LGPD
8.1 Os dados do caso e dos envolvidos são tratados em sigilo e processados apenas para a finalidade de elaboração da peça contratada.
8.2 O cliente declara possuir base legal e autorização para compartilhar os dados pessoais que insere no sistema.

9. LIMITAÇÃO DE RESPONSABILIDADE
A PETICIONA não responde por decisões judiciais, perda de prazos processuais, equívocos de protocolo ou estratégia adotada pelo(a) advogado(a), uma vez que tais responsabilidades são exclusivas do profissional contratante.

10. FORO E DISPOSIÇÕES GERAIS
10.1 Este instrumento é regido pelas leis da República Federativa do Brasil.
10.2 Fica eleito o foro da comarca da sede da PETICIONA para dirimir eventuais controvérsias.
10.3 Atualizações destes Termos serão notificadas e poderão exigir novo aceite.

Ao prosseguir, o(a) usuário(a) declara ter lido, compreendido e aceito integralmente este instrumento.`;

export function TermsAcceptanceDialog({ open }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [acceptTerms1, setAcceptTerms1] = useState(false);
  const [acceptTerms2, setAcceptTerms2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setScrolled(false);
      setAcceptTerms1(false);
      setAcceptTerms2(false);
    }
  }, [open]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setScrolled(true);
    }
  };

  const canSubmit = scrolled && acceptTerms1 && acceptTerms2 && !submitting;

  const handleAccept = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await acceptTerms();
      toast({ title: "Termos aceitos", description: "Bem-vindo(a) à Peticiona!" });
    } catch {
      toast({ title: "Erro ao registrar aceite", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-3xl gap-4 p-0 sm:p-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
          <DialogTitle className="font-display text-xl text-primary">
            Termos de Uso e Política de Cancelamento
          </DialogTitle>
          <DialogDescription>
            Leia o documento até o fim para habilitar o aceite.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <ScrollArea className="h-[50vh] rounded-md border border-border bg-muted/30">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="h-[50vh] overflow-y-auto px-4 py-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-line"
            >
              {TERMS_TEXT}
            </div>
          </ScrollArea>
          {!scrolled && (
            <p className="mt-2 text-xs text-muted-foreground">
              Role o texto até o final para habilitar as caixas de aceite.
            </p>
          )}
        </div>

        <div className="space-y-3 px-6">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={acceptTerms1}
              onCheckedChange={(v) => setAcceptTerms1(v === true)}
              disabled={!scrolled}
              className="mt-0.5"
            />
            <Label className="text-sm font-normal leading-relaxed cursor-pointer">
              Li, compreendi e aceito integralmente os Termos de Uso e a Política de
              Cancelamento da PETICIONA SERVIÇOS JURÍDICOS.
            </Label>
          </label>
          <label className="flex items-start gap-3">
            <Checkbox
              checked={acceptTerms2}
              onCheckedChange={(v) => setAcceptTerms2(v === true)}
              disabled={!scrolled}
              className="mt-0.5"
            />
            <Label className="text-sm font-normal leading-relaxed cursor-pointer">
              Ao clicar em "Enviar solicitação", autorizo expressamente o INÍCIO IMEDIATO
              da prestação do serviço e estou ciente de que, após o início da execução
              e/ou entrega da peça, perderei o direito de arrependimento, nos termos do
              art. 49, §3º, do CDC.
            </Label>
          </label>
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button
            onClick={handleAccept}
            disabled={!canSubmit}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {submitting ? "Registrando..." : "Concordar e continuar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
