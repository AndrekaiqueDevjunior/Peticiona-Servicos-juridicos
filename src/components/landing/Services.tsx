import { FileText, Gavel, ScrollText, FileSignature, BookOpenCheck, Briefcase } from "lucide-react";

const items = [
  { icon: ScrollText, title: "Petições Iniciais", desc: "Elaboração técnica de petições cíveis, trabalhistas e de família." },
  { icon: FileText, title: "Pareceres Jurídicos", desc: "Análises fundamentadas para tomada de decisão estratégica." },
  { icon: FileSignature, title: "Contratos", desc: "Redação e revisão de contratos empresariais e particulares." },
  { icon: Gavel, title: "Recursos", desc: "Apelações, agravos e embargos com rigor doutrinário." },
  { icon: BookOpenCheck, title: "Pesquisa de Jurisprudência", desc: "Levantamentos atualizados nos tribunais superiores." },
  { icon: Briefcase, title: "Consultoria Empresarial", desc: "Compliance, societário e adequações regulatórias." },
];

const Services = () => (
  <section id="servicos" className="py-24 md:py-32">
    <div className="container">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Catálogo</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">Serviços jurídicos sob medida</h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
        <p className="mt-6 text-muted-foreground">
          Todo trabalho é executado por advogados credenciados, com revisão dupla e prazo definido em contrato.
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
