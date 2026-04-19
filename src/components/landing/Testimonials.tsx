import { Quote } from "lucide-react";

const items = [
  {
    quote: "A Lex Aurea elevou o padrão do nosso escritório. As entregas chegam sempre no prazo e com qualidade impecável.",
    name: "Dra. Helena Vasconcelos",
    role: "Sócia, Vasconcelos & Associados",
  },
  {
    quote: "Centralizamos pareceres e contratos em uma só plataforma. O split de pagamentos com nossos correspondentes ficou trivial.",
    name: "Dr. Augusto Moreira",
    role: "Advogado tributarista",
  },
  {
    quote: "Interface sóbria, fluxo claro e profissionais excelentes. É como ter um departamento jurídico completo a um clique.",
    name: "Mariana Lopes",
    role: "Diretora Jurídica, Grupo Vértice",
  },
];

const Testimonials = () => (
  <section id="depoimentos" className="py-24 md:py-32">
    <div className="container">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Depoimentos</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">Confiança construída no detalhe</h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {items.map((t) => (
          <figure key={t.name} className="relative border border-border bg-card p-8 shadow-card">
            <Quote className="absolute right-6 top-6 h-8 w-8 text-accent/30" />
            <blockquote className="font-display text-lg italic leading-relaxed text-foreground/90">
              "{t.quote}"
            </blockquote>
            <figcaption className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);

export default Testimonials;
