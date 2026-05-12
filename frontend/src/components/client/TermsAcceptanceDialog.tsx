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
Versão 1 – Data de vigência: 01/05/2026
E-mail: contato@peticiona.app.br · Site: peticiona.app.br

CLÁUSULA 1ª – PREÂMBULO E ACEITAÇÃO
O presente instrumento estabelece os Termos de Uso e a Política de Cancelamento que regulam a relação entre a PETICIONA SERVIÇOS JURÍDICOS (doravante denominada "PETICIONA" ou "PLATAFORMA") e o usuário cadastrado (doravante denominado "CONTRATANTE" ou "USUÁRIO"), para a utilização da plataforma digital de peticionamento jurídico.

AO REALIZAR O CADASTRO, ACESSAR A PLATAFORMA OU CONFIRMAR UM PEDIDO, O CONTRATANTE DECLARA TER LIDO, COMPREENDIDO E ACEITO INTEGRALMENTE OS PRESENTES TERMOS, BEM COMO A POLÍTICA DE CANCELAMENTO E O COMPROMISSO DE CONFIDENCIALIDADE NELES CONTIDOS. CASO NÃO CONCORDE COM QUALQUER DISPOSIÇÃO, O CONTRATANTE DEVERÁ ABSTER-SE DE UTILIZAR OS SERVIÇOS.

CLÁUSULA 2ª – DEFINIÇÕES
Para fins deste instrumento, aplicam-se as seguintes definições:
• "PLATAFORMA": sistema digital de peticionamento jurídico operado pela PETICIONA, acessível mediante cadastro prévio.
• "CONTRATANTE": advogado regularmente inscrito na Ordem dos Advogados do Brasil (OAB), pessoa física ou jurídica, que adquire serviços da PLATAFORMA para uso profissional.
• "PEÇA JURÍDICA" ou "PRODUTO DIGITAL": documento jurídico elaborado sob encomenda, de natureza intelectual e personalizada, entregue em formato digital.
• "PEDIDO": solicitação de elaboração de peça jurídica realizada pelo CONTRATANTE por meio da PLATAFORMA, com especificações técnicas e fatos fornecidos pelo próprio CONTRATANTE.
• "PRAZO DE ENTREGA": período de até 3 (três) dias úteis, contados da confirmação do pagamento e do recebimento completo das informações necessárias para elaboração da peça.
• "CHECKOUT": etapa final do processo de compra, na qual o CONTRATANTE confirma o pedido, fornece dados de pagamento e expressa concordância com os presentes Termos.
• "INFORMAÇÕES CONFIDENCIAIS": conjunto de dados, documentos, fatos jurídicos, estratégias processuais, dados de clientes e demais informações compartilhadas pelo CONTRATANTE com a PETICIONA para fins de elaboração das peças, conforme detalhado na Cláusula 11ª.

CLÁUSULA 3ª – OBJETO
A PETICIONA presta serviços de elaboração de minutas de peças jurídicas digitais personalizadas (petições, recursos, contratos, pareceres e demais documentos jurídicos) mediante solicitação do CONTRATANTE, por meio de plataforma digital, com entrega exclusivamente em formato eletrônico.
3.1 Os serviços destinam-se EXCLUSIVAMENTE a advogados regularmente inscritos na OAB, para uso profissional no exercício da advocacia, não se caracterizando relação de consumo voltada a consumidor final.
3.2 A PETICIONA não presta assessoria jurídica, não estabelece relação de mandato e não representa o CONTRATANTE ou seus clientes em quaisquer procedimentos administrativos ou judiciais. A responsabilidade pela adequação, revisão, estratégia jurídica, definição das teses e uso da minuta de peça entregue é exclusiva do CONTRATANTE.
3.3 A PETICIONA não garante, em nenhuma hipótese, o êxito da demanda, tampouco se responsabiliza por resultados decorrentes da utilização da peça elaborada. A atuação da PETICIONA limita-se à redação, formatação e entrega da minuta solicitada, observando as regras do direito brasileiro e buscando, na medida do possível, a utilização de fundamentação jurídica adequada ao caso concreto, incluindo jurisprudência atual e pertinente. Compete exclusivamente ao CONTRATANTE a análise final do conteúdo, a validação das teses jurídicas adotadas e a decisão quanto à utilização da peça no processo.

CLÁUSULA 4ª – CADASTRO E HABILITAÇÃO
4.1 O cadastro na PLATAFORMA é restrito a advogados com inscrição ativa na Ordem dos Advogados do Brasil. O CONTRATANTE deverá informar seu número de inscrição da OAB, estado de inscrição, CPF e demais dados solicitados.
4.2 A PETICIONA reserva-se o direito de validar o número de inscrição informado junto aos cadastros públicos da OAB e de suspender ou cancelar contas em que haja divergência ou irregularidade.
4.3 O CONTRATANTE é responsável pela veracidade, exatidão e atualização de seus dados cadastrais, respondendo civilmente por quaisquer danos decorrentes de informações falsas ou desatualizadas.
4.4 É vedado o compartilhamento de credenciais de acesso. Cada conta é pessoal e intransferível.

CLÁUSULA 5ª – PEDIDO, PAGAMENTO E INÍCIO DA EXECUÇÃO
5.1 O CONTRATANTE realiza o pedido por meio da PLATAFORMA, fornecendo as informações técnicas, fatos, documentos e especificações necessários à elaboração da peça solicitada.
5.2 O pagamento deverá ser efetuado no ato da confirmação do pedido, nas modalidades disponibilizadas pela PLATAFORMA (cartão de crédito, PIX, boleto bancário ou outra forma expressamente indicada).
5.3 AO CONFIRMAR O PAGAMENTO, O CONTRATANTE EXPRESSAMENTE SOLICITA O INÍCIO IMEDIATO DA PRESTAÇÃO DO SERVIÇO e declara ciência de que, em que pese os termos do art. 49, do Código de Defesa do Consumidor, o direito de arrependimento NÃO SE APLICA após o início da execução de serviço de conteúdo digital, quando o consumidor tenha sido prévia e expressamente informado e consentido com tal condição.
5.4 A confirmação do início da execução será registrada em log de sistema com data, hora e endereço IP do CONTRATANTE, constituindo prova eletrônica vinculante.
5.5 É vedada a utilização de cartão de crédito ou débito cujo titular seja pessoa diversa do CONTRATANTE. O uso de cartão de terceiro sem autorização escrita e documentada do titular caracteriza irregularidade contratual grave, eximindo a PETICIONA de qualquer responsabilidade por estorno ou chargeback decorrente dessa situação, sem prejuízo das medidas cabíveis.
5.6 O serviço de elaboração de peças jurídicas contratado por meio da PLATAFORMA é prestado de forma personalíssima e sob encomenda exclusiva, sendo desenvolvido especificamente para atender às necessidades individuais do CONTRATANTE, com base nas informações, fatos, estratégias e peculiaridades do caso concreto fornecidas pelo próprio CONTRATANTE no momento do pedido.
5.7 Em razão da natureza personalíssima do serviço, a peça jurídica produzida não pode, em nenhuma hipótese, ser reaproveitada, revendida, reutilizada ou reintroduzida para outro contratante. Cada peça é criada exclusivamente para o caso e para o CONTRATANTE que a solicitou, sendo irrepetível por sua própria essência, de modo que qualquer cancelamento posterior ao início da execução gera à PETICIONA prejuízo integral e irrecuperável sobre o trabalho intelectual já despendido.
5.8 A lógica subjacente ao direito de arrependimento — qual seja, a possibilidade de o bem ou serviço retornar ao estoque ou à disposição do fornecedor sem maiores gravames — é estruturalmente incompatível com o objeto contratado, pois pressupõe reversibilidade que a natureza do serviço não comporta. O esforço intelectual, o tempo e os recursos empregados na elaboração da peça são consumidos de forma definitiva no momento em que a execução é iniciada, independentemente de eventual desistência posterior do CONTRATANTE.
5.9 A orientação jurisprudencial consolidada nos Tribunais brasileiros reconhece que produtos e serviços elaborados de forma personalizada, segundo especificações individuais do contratante, afastam a aplicação do direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor, tendo em vista que a premissa fundamental desse direito — a restituição do bem ou serviço sem prejuízo ao fornecedor — não se verifica quando o objeto foi integralmente concebido para atender a uma necessidade singular e intransferível.

CLÁUSULA 6ª – PRAZO E ENTREGA
6.1 O prazo de entrega da peça jurídica é de até 3 (três) dias úteis, contados da confirmação do pagamento e do recebimento completo das informações necessárias pelo CONTRATANTE.
6.2 A entrega será realizada por meio da PLATAFORMA e/ou por e-mail cadastrado, com registro automático de data, hora e IP de acesso/download, constituindo prova inequívoca de entrega.
6.3 As peças jurídicas elaboradas e disponibilizadas pela CONTRATADA serão entregues em formato editável (.docx), sem a inclusão de marcas d'água, rodapés ou qualquer outro elemento de identificação.
6.4 A titularidade dos direitos patrimoniais sobre o conteúdo da peça é cedida ao CONTRATANTE para uso no caso concreto para o qual foi solicitada, permitindo-se sua livre revisão, adaptação e adequação conforme a estratégia jurídica adotada.
6.5 Fica expressamente vedada a utilização da mesma peça, no todo ou em parte, para outros processos, clientes ou finalidades diversas daquela originalmente contratada, bem como sua reprodução, distribuição ou comercialização a terceiros, sem autorização prévia e expressa da CONTRATADA. O descumprimento desta cláusula poderá ensejar a responsabilização civil do CONTRATANTE, nos termos da legislação aplicável.
6.6 O prazo poderá ser suspenso ou prorrogado nas seguintes hipóteses: (i) não fornecimento tempestivo das informações solicitadas pelo CONTRATANTE; (ii) necessidade de esclarecimentos adicionais; (iii) caso fortuito ou força maior. A PETICIONA comunicará o CONTRATANTE em caso de prorrogação.

CLÁUSULA 6ª-A – PEDIDOS DE CORREÇÃO
6ª-A.1. Após o recebimento da peça jurídica, o CONTRATANTE terá direito a solicitar até 2 (duas) rodadas de correção sem custo adicional, desde que as solicitações sejam apresentadas dentro do prazo de 5 (cinco) dias úteis contados da data de entrega da peça.
6ª-A.2 Para os fins deste instrumento, entende-se por "rodada de correção" o conjunto de ajustes, revisões ou modificações solicitados pelo CONTRATANTE em uma única comunicação formal encaminhada à PETICIONA. Cada envio de solicitação de correção, independentemente da quantidade de itens nela contida, corresponde a uma rodada.
6ª-A.3 É dever do CONTRATANTE consolidar e apresentar todas as correções desejadas em uma única comunicação por rodada, não sendo admitido o fracionamento de solicitações para fins de contagem do número de rodadas disponíveis. A PETICIONA não está obrigada a tratar comunicações fracionadas como rodada única.
6ª-A.4 A partir da 3ª (terceira) rodada de correção em diante, será cobrado um adicional de 20% (vinte por cento) sobre o valor original da peça contratada por cada nova rodada solicitada. O CONTRATANTE será informado do valor antes de cada cobrança adicional e deverá efetuar o pagamento para que a correção seja processada.
6ª-A.5 Não serão aceitos pedidos de correção que impliquem alteração substancial do objeto originalmente solicitado, como mudança de tese jurídica principal, substituição das partes, alteração do tipo de peça ou reformulação dos fatos narrados. Tais hipóteses configuram novo pedido, sujeito a nova contratação e cobrança integral.
6ª-A.6 Decorrido o prazo de 5 (cinco) dias úteis sem manifestação do CONTRATANTE, a peça entregue será considerada aceita em sua integralidade, não sendo admitidos pedidos de correção, retrabalho ou reembolso a título de insatisfação com o conteúdo entregue.

CLÁUSULA 7ª – POLÍTICA DE CANCELAMENTO E REEMBOLSO

7.1 – Regra Geral
Em razão da natureza do serviço — elaboração de produto intelectual digital, personalizado e sob encomenda, com início imediato da execução mediante expressa solicitação do CONTRATANTE —, NÃO HAVERÁ REEMBOLSO APÓS A ENTREGA DA PEÇA JURÍDICA ao CONTRATANTE.

7.2 – Cancelamento Antes da Execução
O CONTRATANTE poderá cancelar o pedido SEM ÔNUS FINANCEIRO apenas nas seguintes condições CUMULATIVAS:
• O cancelamento seja solicitado formalmente por escrito (e-mail ou canal oficial da PLATAFORMA);
• A solicitação seja realizada ANTES do início efetivo da elaboração da peça;
• A PETICIONA confirme, mediante análise, que nenhum trabalho foi iniciado sobre o pedido.
Verificadas essas condições, o reembolso integral será processado em até 10 (dez) dias úteis, na mesma forma de pagamento utilizada.

7.3 – Hipóteses de Reembolso por Falha da Plataforma
A PETICIONA realizará reembolso integral nas seguintes situações:
• Não entrega da peça no prazo estipulado por culpa exclusiva da PETICIONA;
• Cobrança indevida ou duplicada comprovada;
• Impossibilidade técnica da PLATAFORMA em processar o pedido, devidamente comunicada ao CONTRATANTE.

7.4 – Vedação ao Uso Após Solicitação de Reembolso
O CONTRATANTE que solicitar cancelamento ou reembolso após o recebimento da peça reconhece expressamente que: (i) causou dano à PETICIONA; (ii) está VEDADO de utilizar, reproduzir, apresentar em juízo ou fora dele, ou de qualquer forma aproveitar a peça recebida; e (iii) sujeita-se ao pagamento de multa equivalente ao dobro do valor do serviço contratado, sem prejuízo da reparação por perdas e danos e de comunicação às autoridades competentes.

7.5 – Direito de Arrependimento e Inaplicabilidade
O direito de arrependimento NÃO SE APLICA ao presente contrato, tendo em vista que:
• O serviço consiste em fornecimento de conteúdo digital não armazenado em suporte físico;
• O CONTRATANTE expressamente solicitou o início imediato da execução;
• O CONTRATANTE foi prévia e claramente informado da perda do direito de arrependimento;
• A presente contratação tem finalidade exclusivamente profissional (B2B), destinada ao exercício da advocacia, afastando a hipossuficiência caracterizadora do consumidor vulnerável.

7.6 – Planos de Crédito e Irrestituibilidade do Saldo Utilizado
A PETICIONA poderá disponibilizar ao CONTRATANTE planos de crédito pré-pagos ("PLANOS"), mediante os quais o CONTRATANTE adquire antecipadamente um volume de créditos a serem utilizados na PLATAFORMA.
7.6.1 Uma vez adquirido o PLANO e utilizado o saldo de créditos, integral ou parcialmente, NÃO HAVERÁ DEVOLUÇÃO DO VALOR CORRESPONDENTE AOS CRÉDITOS CONSUMIDOS, seja a que título for.
7.6.2 Os créditos adquiridos e ainda não utilizados (saldo remanescente) somente serão reembolsáveis nas hipóteses do item 7.3 (falha exclusiva da PETICIONA), desde que o CONTRATANTE não tenha feito uso de qualquer crédito do PLANO adquirido.
7.6.3 O CONTRATANTE declara ciência de que os créditos dos PLANOS possuem prazo de validade informado no momento da compra, findo o qual expirarão sem direito a reembolso, prorrogação ou compensação, salvo disposição expressa em contrário constante da oferta do PLANO.
7.6.4 A aquisição de PLANO implica aceite específico e irretratável das condições de não reembolso aqui estabelecidas.

7.7 – Inaplicabilidade do Direito de Arrependimento por Analogia Jurisprudencial
A vedação ao reembolso após o início da execução fundamenta-se na inaplicabilidade do direito de arrependimento previsto no art. 49 do CDC, pelos seguintes fundamentos autônomos e cumulativos:
a) Natureza personalíssima e sob encomenda;
b) Prejuízo integral ao fornecedor;
c) Início imediato mediante solicitação expressa do CONTRATANTE;
d) Ausência do pressuposto de reversibilidade;
e) Contratação para uso profissional (B2B), que afasta a condição de consumidor hipossuficiente.

7.8 O CONTRATANTE declara expressamente ter compreendido, antes de finalizar a compra, que o serviço contratado é personalizado, irrepetível e executado sob suas especificações individuais.

CLÁUSULA 8ª – CHARGEBACKS E ESTORNOS
8.1 O CONTRATANTE reconhece que a solicitação indevida de chargeback ou estorno junto à operadora de cartão de crédito, após o recebimento e/ou uso da peça jurídica, constitui ATO ILÍCITO, configurando fraude contra a PETICIONA, passível de:
• Ação de cobrança pelo valor integral do serviço, acrescido de multa e honorários advocatícios;
• Inclusão do CONTRATANTE em cadastros de inadimplentes (Serasa, SPC e similares);
• Comunicação ao Conselho Seccional da OAB competente, para apuração de eventual infração disciplinar;
• Registro de boletim de ocorrência e demais medidas criminais cabíveis.
8.2 A PETICIONA manterá todos os registros eletrônicos de pedido, aceite dos termos, início de execução, entrega e acesso/download da peça.
8.3 O CONTRATANTE que efetuar chargeback indevido terá sua conta imediatamente suspensa e será incluído em lista interna de bloqueio.

CLÁUSULA 9ª – PROPRIEDADE INTELECTUAL
9.1 As peças jurídicas elaboradas pela PETICIONA são criações intelectuais originais, protegidas pela Lei nº 9.610/1998. Com o pagamento integral do serviço, o CONTRATANTE adquire licença de uso restrito, não exclusivo e intransferível da peça, para utilização exclusiva no caso para o qual foi solicitada.
9.2 É vedado ao CONTRATANTE: (i) reproduzir ou distribuir as peças para terceiros; (ii) utilizar as peças como modelos para elaboração de outros documentos sem autorização; (iii) reivindicar autoria exclusiva das peças sem menção à PETICIONA.
9.3 A marca, nome, logotipo, software e demais elementos da PLATAFORMA são de propriedade exclusiva da PETICIONA.

CLÁUSULA 10ª – PRIVACIDADE E PROTEÇÃO DE DADOS
10.1 O tratamento de dados pessoais observará a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD) e a Política de Privacidade da PETICIONA.
10.2 Os dados coletados destinam-se à prestação dos serviços contratados, cumprimento de obrigações legais, prevenção à fraude e melhoria da PLATAFORMA.
10.3 Os logs de acesso, dados de transação e registros de entrega poderão ser utilizados para fins de contestação de chargebacks, defesa em processos e cumprimento de determinações legais.

CLÁUSULA 11ª – SIGILO E CONFIDENCIALIDADE
11.1 Escopo: consideram-se INFORMAÇÕES CONFIDENCIAIS todos os dados, documentos, fatos jurídicos, estratégias processuais, identificação de partes e terceiros, conteúdo probatório e quaisquer outros elementos compartilhados pelo CONTRATANTE com a PETICIONA.
11.2 Exclusões: não serão tratadas como confidenciais informações de domínio público, já em posse da PETICIONA sem obrigação de sigilo, obtidas de terceiros de boa-fé, desenvolvidas autonomamente, ou cuja divulgação seja autorizada por escrito.
11.3 Obrigações da PETICIONA: tratar com sigilo absoluto, usar exclusivamente para a peça contratada, não compartilhar com terceiros (salvo determinação legal), limitar acesso aos colaboradores estritamente necessários e comunicar incidentes.
11.4 Revelação por determinação legal: notificar o CONTRATANTE, limitar à informação indispensável e cooperar com medidas protetivas.
11.5 Vigência do sigilo: durante a relação contratual e por 5 (cinco) anos após o término.
11.6 Destinação após encerramento: eliminar ou devolver as informações em até 30 dias.
11.7 Responsabilidade por violação: responsabilidade civil pelos danos + multa não compensatória de R$ 1.000,00 por evento.
11.8 O acesso às informações não implica concessão de qualquer direito ou licença sobre elas.

CLÁUSULA 12ª – RESPONSABILIDADES E LIMITAÇÕES
12.1 A PETICIONA responsabiliza-se pela entrega da peça dentro do prazo e com a qualidade técnica esperada.
12.2 A PETICIONA NÃO SE RESPONSABILIZA: (i) pelo êxito perante o Poder Judiciário; (ii) por decisões desfavoráveis; (iii) por erros nas informações fornecidas pelo CONTRATANTE; (iv) por danos indiretos, lucros cessantes ou danos morais.
12.3 A responsabilidade máxima da PETICIONA, exceto nas hipóteses da Cláusula 11ª, limita-se ao valor pago pelo pedido específico que originou o dano.

CLÁUSULA 13ª – SUSPENSÃO E RESCISÃO
13.1 A PETICIONA poderá suspender ou encerrar a conta sem aviso prévio em caso de: dados falsos, violação destes Termos, chargeback indevido, uso ilícito da PLATAFORMA, ou inscrição cancelada/suspensa na OAB.
13.2 A rescisão não desobriga o CONTRATANTE de obrigações vencidas, nem implica reembolso de valores já processados, salvo nas hipóteses da Cláusula 7ª.

CLÁUSULA 14ª – DISPOSIÇÕES GERAIS
14.1 Eventual nulidade de qualquer cláusula não afetará a validade das demais.
14.2 A tolerância da PETICIONA não implica renúncia ao direito de exigir cumprimento posterior.
14.3 Os Termos poderão ser alterados a qualquer tempo, com comunicação prévia. A continuidade do uso implica aceitação das novas condições.
14.4 Fica eleito o foro da Comarca de São Paulo/SP para dirimir controvérsias.

CONFIRMAÇÃO E ACEITE ELETRÔNICO
O CONTRATANTE declara, no ato do checkout, mediante dupla confirmação, que: (i) leu, compreendeu e aceita integralmente os Termos de Uso, a Política de Cancelamento e o Compromisso de Confidencialidade; (ii) solicita expressamente o INÍCIO IMEDIATO da prestação do serviço, ciente de que perderá o direito de arrependimento após o início da execução e/ou entrega da peça, nos termos do art. 49 do CDC.

PETICIONA SERVIÇOS JURÍDICOS
Aceite realizado eletronicamente no ato do checkout, com registro de data, hora e IP do CONTRATANTE.`;

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
