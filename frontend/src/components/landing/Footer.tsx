import { useState } from "react";
import { Instagram } from "lucide-react";
import logo from "@/assets/peticiona-logo.png";
import ContactForm from "./ContactForm";
import { useContactInfo } from "@/lib/contactInfo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// TikTok icon (lucide doesn't include it)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1.84-.07Z" />
  </svg>
);

const Footer = () => {
  const [openPrivacy, setOpenPrivacy] = useState(false);
  const { email, whatsappDisplay, whatsappRaw } = useContactInfo();

  return (
  <footer className="bg-primary text-primary-foreground">
    <div className="container py-16">
      <div className="grid gap-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-sm bg-primary-foreground/10 p-1.5">
              <img src={logo} alt="Peticiona" className="h-full w-full object-contain" />
            </span>
            <div>
              <p className="font-display text-lg">PETICIONA</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60">Serviços Jurídicos</p>
            </div>
          </div>
          <p className="mt-6 max-w-md text-sm text-primary-foreground/70">
            Estrutura jurídica sob demanda para escritórios que querem produzir mais
            sem aumentar a equipe.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a
              href="#"
              aria-label="Instagram"
              className="grid h-9 w-9 place-items-center border border-primary-foreground/20 text-primary-foreground/80 transition-elegant hover:border-accent hover:text-accent"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="TikTok"
              className="grid h-9 w-9 place-items-center border border-primary-foreground/20 text-primary-foreground/80 transition-elegant hover:border-accent hover:text-accent"
            >
              <TikTokIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Navegação</p>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">
            <li><a href="#quem-somos" className="hover:text-accent">Quem somos</a></li>
            <li><a href="#planos" className="hover:text-accent">Preços</a></li>
            <li><a href="#contato" className="hover:text-accent">Contato</a></li>
            <li>
              <button
                type="button"
                onClick={() => setOpenPrivacy(true)}
                className="hover:text-accent"
              >
                Política de Privacidade
              </button>
            </li>
          </ul>
        </div>

        <div id="contato">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Contato</p>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">
            <li>
              <a href={`mailto:${email}`} className="hover:text-accent">
                {email}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${whatsappRaw}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                WhatsApp: {whatsappDisplay}
              </a>
            </li>
            <li>Atendimento Seg–Sex · 9h–18h</li>
          </ul>
          <ContactForm />
        </div>
      </div>
      <div className="divider-gold mt-12" />
      <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs text-primary-foreground/60 md:flex-row">
        <p>© {new Date().getFullYear()} Peticiona Serviços Jurídicos. Todos os direitos reservados.</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpenPrivacy(true)}
            className="hover:text-accent underline-offset-4 hover:underline"
          >
            Política de Privacidade
          </button>
          <span>·</span>
          <p>Conformidade OAB · LGPD</p>
        </div>
      </div>
    </div>

    <Dialog open={openPrivacy} onOpenChange={setOpenPrivacy}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white text-foreground rounded-xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            Política de Privacidade – Peticiona Serviços Jurídicos
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-sm leading-relaxed text-foreground/90">
          <p>
            A Peticiona Serviços Jurídicos respeita a sua privacidade e está comprometida com a proteção dos dados pessoais coletados por meio desta plataforma. Esta Política de Privacidade tem como objetivo explicar, de forma simples e transparente, como as suas informações são tratadas.
          </p>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">1. Coleta de dados</h3>
            <p>Podemos coletar os seguintes dados:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Informações fornecidas pelo usuário, como nome, e-mail, telefone e dados profissionais;</li>
              <li>Dados inseridos ao realizar solicitações na plataforma;</li>
              <li>Documentos e arquivos enviados pelo usuário;</li>
              <li>Informações de navegação, como endereço IP, cookies e registros de acesso.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">2. Finalidade do uso dos dados</h3>
            <p>Os dados coletados são utilizados para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Permitir o funcionamento da plataforma;</li>
              <li>Receber, organizar e processar solicitações realizadas pelos usuários;</li>
              <li>Viabilizar a prestação dos serviços solicitados;</li>
              <li>Entrar em contato com o usuário, quando necessário;</li>
              <li>Melhorar a experiência de uso da plataforma;</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">3. Compartilhamento de dados</h3>
            <p>Os dados poderão ser compartilhados, quando necessário, nas seguintes situações:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Com profissionais responsáveis pela execução das demandas solicitadas;</li>
              <li>Com fornecedores de tecnologia que auxiliam no funcionamento da plataforma;</li>
              <li>Para cumprimento de obrigações legais ou determinações de autoridades competentes.</li>
            </ul>
            <p>A Peticiona Serviços Jurídicos não comercializa dados pessoais.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">4. Armazenamento e segurança</h3>
            <p>
              Adotamos medidas técnicas e organizacionais adequadas para proteger os dados pessoais contra acesso não autorizado, perda, alteração ou qualquer forma de tratamento inadequado.
            </p>
            <p>
              Os dados serão armazenados pelo tempo necessário para cumprir as finalidades descritas nesta Política, respeitando a legislação aplicável.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">5. Uso de cookies</h3>
            <p>
              Utilizamos cookies para melhorar a navegação, entender como a plataforma é utilizada e aprimorar nossos serviços.
            </p>
            <p>
              O usuário pode configurar seu navegador para recusar ou limitar o uso de cookies, se desejar.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">6. Direitos do titular</h3>
            <p>Nos termos da legislação vigente, o usuário poderá:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Solicitar acesso aos seus dados pessoais;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a exclusão de dados, quando aplicável;</li>
              <li>Revogar o consentimento para tratamento de dados.</li>
            </ul>
            <p>As solicitações podem ser realizadas por meio do canal de contato indicado abaixo.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">7. Alterações nesta política</h3>
            <p>
              Esta Política de Privacidade poderá ser atualizada a qualquer momento, sendo recomendada a sua revisão periódica.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">8. Contato</h3>
            <p>Em caso de dúvidas, solicitações ou questões relacionadas à privacidade dos dados, entre em contato:</p>
            <p>E-mail: <a href={`mailto:${email}`} className="text-primary underline">{email}</a></p>
          </section>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            Última atualização: 27/04/2026
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </footer>
  );
};

export default Footer;
