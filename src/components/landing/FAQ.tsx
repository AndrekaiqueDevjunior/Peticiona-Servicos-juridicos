import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Como funcionam os prazos de entrega?", a: "Cada serviço tem prazo estabelecido no momento da contratação, geralmente entre 24h e 5 dias úteis, conforme complexidade." },
  { q: "Os profissionais são advogados credenciados?", a: "Sim. Todos os profissionais passam por verificação da OAB e curadoria técnica antes de atender pedidos na plataforma." },
  { q: "Posso cancelar meu plano a qualquer momento?", a: "Sim. O cancelamento é imediato pelo painel e não há taxas adicionais. O acesso permanece ativo até o fim do ciclo pago." },
  { q: "Como funciona o split de pagamentos?", a: "Utilizamos Stripe Connect. O valor pago é dividido automaticamente entre a plataforma e o profissional responsável conforme a regra configurada." },
  { q: "Meus documentos estão seguros?", a: "Sim. Todos os arquivos são armazenados com criptografia em repouso e em trânsito, com acesso restrito por papel de usuário." },
  { q: "Posso solicitar serviços fora do plano?", a: "Sim. Serviços avulsos podem ser contratados a qualquer momento, com desconto progressivo conforme seu plano." },
];

const FAQ = () => (
  <section id="faq" className="bg-secondary/50 py-24 md:py-32">
    <div className="container max-w-3xl">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Perguntas frequentes</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">Tire suas dúvidas</h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
      </div>
      <Accordion type="single" collapsible className="mt-12">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-b border-border">
            <AccordionTrigger className="py-5 text-left font-display text-lg hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FAQ;
