import { FileText, Gavel, ScrollText, FileSignature, BookOpenCheck, Briefcase } from "lucide-react";

const items = [
  {
    icon: ScrollText,
    title: "Petições Iniciais",
    desc: "Petição inicial comum, mandado de segurança e cumprimento de sentença.",
  },
  {
    icon: FileSignature,
    title: "Defesas",
    desc: "Contestação, embargos à execução e impugnação ao cumprimento de sentença.",
  },
  {
    icon: Gavel,
    title: "Recursos",
    desc: "Apelação, agravos, embargos de declaração, recursos ordinário, especial e extraordinário.",
  },
  {
    icon: FileText,
    title: "Manifestações Gerais",
    desc: "Contrarrazões, petições intermediárias, manifestações, alegações e razões finais.",
  },
  {
    icon: Briefcase,
    title: "Administrativo / Extrajudicial",
    desc: "Notificação extrajudicial, defesa e recurso administrativo, requerimentos.",
  },
  {
    icon: BookOpenCheck,
    title: "Sob medida para o seu caso",
    desc: "Não encontrou sua peça? Fale com a equipe e atendemos demandas específicas.",
  },
];

const Services = () => (
  <section id="servicos" className="py-24 md:py-32">
    <div className="container">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Serviços</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">
          Quais demandas do seu escritório você quer otimizar hoje?
        </h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
        <p className="mt-6 text-muted-foreground text-base">
          Delegue a produção das suas peças jurídicas e foque no atendimento, na estratégia
          e na expansão do seu negócio.
        </p>
      </div>

      <div className="mt-16 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <article
            key={it.title}
            className="group bg-card p-8 transition-elegant hover:bg-secondary"
          >
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center border border-accent/40 bg-accent/10 text-accent transition-elegant group-hover:bg-accent group-hover:text-accent-foreground">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-xl">{it.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.desc}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Services;
