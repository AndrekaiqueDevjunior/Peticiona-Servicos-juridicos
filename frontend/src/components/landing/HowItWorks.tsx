import { ClipboardList, Upload, FileCheck2, Inbox } from "lucide-react";

const steps = [
  { icon: ClipboardList, n: "01", title: "Cadastre a demanda", desc: "Descreva o tipo de peça, área e detalhes do caso em poucos minutos." },
  { icon: Upload, n: "02", title: "Envie os documentos", desc: "Anexe processos, contratos e provas com armazenamento seguro e criptografado." },
  { icon: FileCheck2, n: "03", title: "Acompanhe a produção", desc: "Receba atualizações de status e prazo previsto direto no seu painel." },
  { icon: Inbox, n: "04", title: "Receba a entrega", desc: "Peça revisada, formatada e pronta para protocolo, no prazo combinado." },
];

const HowItWorks = () => (
  <section id="como-funciona" className="bg-secondary/40 py-24 md:py-32">
    <div className="container">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Como funciona</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">
          Cadastre seu pedido de forma simples e rápida.
        </h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
        <p className="mt-6 text-muted-foreground">
          Registre sua demanda, envie os documentos e deixe a produção com quem é especialista.
          Mais organização, prazos sob controle e maior eficiência na rotina do seu escritório.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.n} className="relative border border-border bg-card p-8 shadow-card">
            <span className="font-display text-5xl text-accent/30">{s.n}</span>
            <s.icon className="mt-4 h-6 w-6 text-accent" />
            <h3 className="mt-4 font-display text-xl">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
