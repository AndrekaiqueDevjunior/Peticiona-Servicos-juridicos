import { Zap, Wallet, TrendingUp, MousePointerClick, Repeat, Scale, Clock, Headphones, LineChart, Unlock } from "lucide-react";

const items = [
  { icon: Zap, title: "Mais produtividade, menos sobrecarga", desc: "Delegue a elaboração das suas peças e libere seu tempo para focar no crescimento do escritório, atendimento ao cliente e estratégia." },
  { icon: Wallet, title: "Redução de custos operacionais", desc: "Diminua gastos com equipe interna, contratações e rotatividade, mantendo uma operação mais enxuta e eficiente." },
  { icon: TrendingUp, title: "Escala sem complicação", desc: "Aumente sua capacidade de atendimento sem precisar expandir sua estrutura. Produza mais, com organização e consistência." },
  { icon: MousePointerClick, title: "Simplicidade no uso", desc: "Uma plataforma intuitiva e fácil de utilizar, sem a complexidade dos sistemas tradicionais do meio jurídico." },
  { icon: Repeat, title: "Solicitações sob demanda", desc: "Envie quantas demandas quiser, quando quiser, com liberdade e flexibilidade para atender seu fluxo de trabalho." },
  { icon: Scale, title: "Atendimento em diversas áreas do Direito", desc: "Conte com suporte para diferentes tipos de demandas jurídicas, ampliando sua atuação sem precisar de especialistas internos." },
  { icon: Clock, title: "Prazos organizados e previsíveis", desc: "Saiba exatamente quando sua demanda será entregue e mantenha o controle total da sua rotina." },
  { icon: Headphones, title: "Suporte dedicado", desc: "Equipe disponível para auxiliar você sempre que precisar, sem custos adicionais." },
  { icon: LineChart, title: "Previsibilidade financeira", desc: "Modelo claro e transparente, sem cobranças inesperadas por complexidade." },
  { icon: Unlock, title: "Mais liberdade para crescer", desc: "Menos dependência de equipe interna, menos burocracia e mais foco no que realmente gera resultado para o seu escritório." },
];

const Advantages = () => (
  <section id="quem-somos" className="py-24 md:py-32">
    <div className="container">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent">Vantagens</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl">
          Um novo nível para o seu escritório.
        </h2>
        <div className="divider-gold mx-auto mt-6 w-24" />
        <p className="mt-6 text-muted-foreground">
          Tenha uma estrutura jurídica sob demanda para produzir suas peças com qualidade,
          previsibilidade e escala — sem aumentar sua equipe.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <article
            key={it.title}
            className="group flex gap-5 border border-border bg-card p-6 shadow-card transition-elegant hover:border-accent/60 hover:shadow-elegant"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent transition-elegant group-hover:bg-accent group-hover:text-accent-foreground">
              <it.icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg leading-snug">{it.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{it.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Advantages;
