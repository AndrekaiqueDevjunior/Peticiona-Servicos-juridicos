import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  calcularPrecoPedido,
  formatBRL,
  useUserPricingProfile,
} from "@/lib/pricing";
import { useBalance, hasCommonCredit } from "@/lib/balance";
import { calcularPrazo, modalidadeParaPrazo } from "@/lib/prazos";
import { api } from "@/lib/api";
import {
  AlertCircle,
  CalendarIcon,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Send,
  Trash2,
  UploadCloud,
  Wallet,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";

const AREAS_DIREITO = [
  "Direito Civil",
  "Direito do Consumidor",
  "Direito Previdenciário",
  "Direito Trabalhista",
  "Direito Tributário",
  "Direito Empresarial",
  "Direito de Família",
  "Direito Sucessório",
  "Direito Imobiliário",
  "Direito Bancário",
  "Direito Médico / da Saúde",
  "Direito Administrativo",
  "Direito Constitucional",
  "Direito Penal",
  "Direito Ambiental",
  "Direito Eleitoral",
];

const TIPOS_PETICAO = {
  "PETIÇÕES INICIAIS": [
    "Petição inicial comum",
    "Mandado de segurança",
    "Cumprimento de sentença (inicial)",
  ],
  "DEFESAS": [
    "Contestação",
    "Embargos à execução",
    "Impugnação ao cumprimento de sentença",
  ],
  "RECURSOS": [
    "Apelação",
    "Agravo de instrumento",
    "Agravo interno",
    "Embargos de declaração",
    "Recurso ordinário",
    "Recurso especial",
    "Recurso extraordinário",
    "Agravo em recurso especial",
    "Agravo em recurso extraordinário",
  ],
  "MANIFESTAÇÕES GERAIS": [
    "Contrarrazões",
    "Petição intermediária",
    "Manifestação",
    "Alegações finais",
    "Razões finais",
  ],
  "ADMINISTRATIVO / EXTRAJUDICIAL": [
    "Notificação extrajudicial",
    "Defesa administrativa",
    "Recurso administrativo",
    "Requerimentos administrativos",
  ],
};

const TIPOS_PARTE = [
  "Autor",
  "Réu",
  "Litisconsorte ativo",
  "Litisconsorte passivo",
  "Requerente",
  "Requerido",
  "Recorrente",
  "Recorrido",
  "Embargante",
  "Embargado",
  "Exequente",
  "Executado",
  "Credor",
  "Devedor",
  "Arrematante",
  "Adjudicante",
  "Alimentante",
  "Alimentando",
  "Inventariante",
  "Herdeiro",
  "Curador",
  "Tutor",
  "Interditando",
  "Impetrante",
  "Impetrado",
  "Autoridade coatora",
  "Paciente (Habeas Corpus)",
  "Querelante",
  "Querelado",
  "Acusado / Réu",
  "Indiciado",
  "Denunciado",
  "Vítima / Ofendido",
  "Autuado",
  "Impugnante",
];

interface Parte {
  id: string;
  nome: string;
  tipo: string;
}

interface AttachedFile {
  id: string;
  file: File;
  previewUrl?: string;
}

type CommentAuthorRole = "cliente" | "redator";

interface Comentario {
  id: string;
  autorNome: string;
  autorRole: CommentAuthorRole;
  texto: string;
  criadoEm: Date;
  deletado: boolean;
  deletadoEm?: Date;
  deletadoPor?: string;
}

// Limite alinhado com MAX_UPLOAD_MB do backend (default 50MB; produção pode ajustar).
const MAX_FILE_SIZE = 50 * 1024 * 1024;
// Formatos oficiais aceitos: PDF, Word .doc, Word .docx, PNG, JPG, JPEG.
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"] as const;
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
] as const;
const ACCEPTED_TYPES = [...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME_TYPES].join(",");

const isAcceptedFile = (file: File) => {
  const name = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) return true;
  return false;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

interface NewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewRequestDialog = ({ open, onOpenChange }: NewRequestDialogProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [areaDireito, setAreaDireito] = useState("");
  const [tipoPeticao, setTipoPeticao] = useState("");
  const [dataPublicacao, setDataPublicacao] = useState<Date | undefined>();
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [comarca, setComarca] = useState("");
  const [justicaGratuita, setJusticaGratuita] = useState("nao");
  const [partes, setPartes] = useState<Parte[]>([
    { id: crypto.randomUUID(), nome: "", tipo: "" },
  ]);
  const [resumoCaso, setResumoCaso] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [tutelaUrgencia, setTutelaUrgencia] = useState("nao");
  const [advogadoSubscritor, setAdvogadoSubscritor] = useState("");
  const [arquivos, setArquivos] = useState<AttachedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toggle de upgrade Express — quando ativo, o pedido é redirecionado para checkout separado
  const [expressUpgrade, setExpressUpgrade] = useState(false);

  const balance = useBalance();

  const temCreditoComum = hasCommonCredit(balance);
  const podeProceder = temCreditoComum;
  const mensagemBloqueio = !temCreditoComum
    ? "Você não possui créditos. Adquira um plano para receber mais créditos."
    : null;

  // Cliente sempre comenta como "cliente"; a visão de redator é exclusiva do
  // painel interno (staff/admin), não do modal de novo pedido.
  const viewerRole: CommentAuthorRole = "cliente";
  const viewerNome = "Você (Cliente)";
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");

  const addComentario = () => {
    const texto = novoComentario.trim();
    if (!texto) return;
    setComentarios((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        autorNome: viewerNome,
        autorRole: viewerRole,
        texto,
        criadoEm: new Date(),
        deletado: false,
      },
    ]);
    setNovoComentario("");
  };

  // Cliente não exclui comentários — apenas visualiza os próprios e os do
  // redator que ainda não foram removidos.
  const comentariosVisiveis = comentarios.filter((c) => !c.deletado);

  const addParte = () =>
    setPartes((p) => [...p, { id: crypto.randomUUID(), nome: "", tipo: "" }]);

  const removeParte = (id: string) =>
    setPartes((p) => (p.length > 1 ? p.filter((x) => x.id !== id) : p));

  const updateParte = (id: string, field: "nome" | "tipo", value: string) =>
    setPartes((p) => p.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const novos: AttachedFile[] = [];
    Array.from(files).forEach((file) => {
      if (!isAcceptedFile(file)) {
        toast({
          title: "Formato não suportado",
          description: `${file.name}: aceitamos apenas PDF, DOC, DOCX, PNG, JPG e JPEG.`,
          variant: "destructive",
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o limite de ${formatBytes(MAX_FILE_SIZE)}.`,
          variant: "destructive",
        });
        return;
      }
      const isImage = file.type.startsWith("image/");
      novos.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      });
    });
    if (novos.length) setArquivos((prev) => [...prev, ...novos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeArquivo = (id: string) =>
    setArquivos((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });

  const reset = () => {
    setAreaDireito("");
    setTipoPeticao("");
    setExpressUpgrade(false);
    setDataPublicacao(undefined);
    setNumeroProcesso("");
    setCompetencia("");
    setComarca("");
    setJusticaGratuita("nao");
    setPartes([{ id: crypto.randomUUID(), nome: "", tipo: "" }]);
    setResumoCaso("");
    setDetalhes("");
    setTutelaUrgencia("nao");
    setAdvogadoSubscritor("");
    arquivos.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setArquivos([]);
    setComentarios([]);
    setNovoComentario("");
    setSuccess(false);
  };

  // Cancelar = mantém rascunho (apenas fecha o modal sem reset).
  const handleCancel = () => {
    onOpenChange(false);
  };

  // Após sucesso, fechar o modal limpa tudo.
  const handleClose = (next: boolean) => {
    if (!next && success) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaDireito) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione a área do Direito.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const uploadedDocuments = arquivos.length
        ? await api.documents.upload(arquivos.map((item) => item.file))
        : { documents: [] };

      const result = await api.petitions.create({
        area_direito: areaDireito,
        tipo_peticao: tipoPeticao,
        numero_processo: numeroProcesso,
        data_publicacao: dataPublicacao ? format(dataPublicacao, "yyyy-MM-dd") : "",
        justica_gratuita: justicaGratuita === "sim",
        tutela_urgencia: tutelaUrgencia === "sim",
        advogado_subscritor: advogadoSubscritor,
        resumo_caso: resumoCaso,
        detalhes,
        partes: partes.map((parte) => ({ nome: parte.nome, tipo: parte.tipo })),
        document_ids: uploadedDocuments.documents.map((document) => document.id),
        express_upgrade: expressUpgrade || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["petitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });

      if (expressUpgrade && result.order?.id) {
        onOpenChange(false);
        navigate(
          `/checkout?service=servico_express_upgrade&service_order_id=${result.order.id}`,
        );
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      toast({
        title: "Erro ao enviar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Tela de sucesso após finalizar pedido
  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-accent/15 p-3">
              <CheckCircle2 className="h-10 w-10 text-accent" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">
                Pedido cadastrado com sucesso!
              </DialogTitle>
              <DialogDescription className="text-center">
                Acompanhe o andamento na aba <strong>"Meus pedidos"</strong> e
                fique atento aos e-mails e mensagens de WhatsApp enviados pela
                Peticiona!
              </DialogDescription>
            </DialogHeader>
            <Button
              type="button"
              className="mt-2 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => {
                reset();
                onOpenChange(false);
                navigate("/area-cliente/pedidos");
              }}
            >
              Ir para Meus pedidos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para criar um novo pedido de petição. Se
            fechar sem finalizar, o pedido fica salvo como rascunho — clique em
            cancelar para descartá-lo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 1. Dados da Solicitação */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              1. Dados da Solicitação
            </h3>

            <div className="space-y-2">
              <Label htmlFor="area-direito">
                Qual a área do Direito da Petição?{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select value={areaDireito} onValueChange={setAreaDireito}>
                <SelectTrigger id="area-direito">
                  <SelectValue placeholder="Selecione uma área" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS_DIREITO.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-peticao">Qual o tipo de petição?</Label>
              <Select
                value={tipoPeticao}
                onValueChange={(v) => {
                  setTipoPeticao(v);
                  setExpressUpgrade(false);
                }}
              >
                <SelectTrigger id="tipo-peticao">
                  <SelectValue placeholder="Selecione um tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_PETICAO).map(([grupo, tipos]) => (
                    <div key={grupo}>
                      <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                        {grupo}
                      </p>
                      {tipos.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* 2. Dados do processo */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              2. Dados do processo
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data da publicação (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataPublicacao && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataPublicacao
                        ? format(dataPublicacao, "PPP", { locale: ptBR })
                        : "Escolha uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataPublicacao}
                      onSelect={setDataPublicacao}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero-processo">
                  Número do Processo (opcional)
                </Label>
                <Input
                  id="numero-processo"
                  placeholder="0000000-00.0000.0.00.0000"
                  value={numeroProcesso}
                  onChange={(e) => setNumeroProcesso(e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="competencia">Competência</Label>
                <Input
                  id="competencia"
                  placeholder="Ex.: Vara Cível, Juizado Especial..."
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  maxLength={150}
                />
                <p className="text-xs text-muted-foreground">
                  Indique qual a competência para ajuizamento da ação.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comarca">
                  Qual a comarca que será distribuída a ação?
                </Label>
                <Input
                  id="comarca"
                  placeholder="Cidade/UF"
                  value={comarca}
                  onChange={(e) => setComarca(e.target.value)}
                  maxLength={150}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Será necessário requerer justiça gratuita?</Label>
              <RadioGroup
                value={justicaGratuita}
                onValueChange={setJusticaGratuita}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="jg-sim" />
                  <Label htmlFor="jg-sim" className="font-normal">
                    Sim
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="jg-nao" />
                  <Label htmlFor="jg-nao" className="font-normal">
                    Não
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </section>

          {/* 3. Partes */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              3. Quem são as partes no processo?
            </h3>

            <div className="space-y-3">
              {partes.map((parte, idx) => (
                <div
                  key={parte.id}
                  className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`nome-${parte.id}`} className="text-xs">
                      Nome da parte {idx + 1}
                    </Label>
                    <Input
                      id={`nome-${parte.id}`}
                      placeholder="Nome completo"
                      value={parte.nome}
                      onChange={(e) =>
                        updateParte(parte.id, "nome", e.target.value)
                      }
                      maxLength={150}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de parte</Label>
                    <Select
                      value={parte.tipo}
                      onValueChange={(v) => updateParte(parte.id, "tipo", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_PARTE.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParte(parte.id)}
                      disabled={partes.length === 1}
                      aria-label="Remover parte"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addParte}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar parte
            </Button>
          </section>

          {/* 4. Informações sobre o caso */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              4. Informações sobre o caso
            </h3>
            <p className="text-sm text-muted-foreground">
              Escreva detalhes do caso concreto e as teses que pretende levantar
              em sua minuta. Isso é imprescindível para a criação de uma petição
              personalizada. Lembre-se: quanto mais detalhes, melhor!
            </p>
            <div className="flex gap-3 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm text-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p>
                Os <strong>anexos são muito importantes</strong>, sobretudo para
                narrar os fatos do caso. Em <strong>processos em segredo de
                justiça</strong>, é <strong>obrigatória</strong> a juntada do
                processo completo.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resumo">Do que se trata o processo?</Label>
              <Textarea
                id="resumo"
                placeholder="Descreva brevemente o objeto do processo"
                value={resumoCaso}
                onChange={(e) => setResumoCaso(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="detalhes">
                Quais tópicos são imprescindíveis em sua petição?
              </Label>
              <p className="text-xs text-muted-foreground">
                As teses levantadas na petição são de inteira responsabilidade
                do cliente. Assim, devem ser obrigatoriamente pedidas nesse
                tópico.
              </p>
              <Textarea
                id="detalhes"
                placeholder="Liste os tópicos, pedidos e teses que devem constar obrigatoriamente na petição"
                value={detalhes}
                onChange={(e) => setDetalhes(e.target.value)}
                rows={6}
                maxLength={5000}
              />
            </div>

            <div className="space-y-2">
              <Label>Será necessário requerer tutela de urgência?</Label>
              <RadioGroup
                value={tutelaUrgencia}
                onValueChange={setTutelaUrgencia}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="tu-sim" />
                  <Label htmlFor="tu-sim" className="font-normal">
                    Sim
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="tu-nao" />
                  <Label htmlFor="tu-nao" className="font-normal">
                    Não
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="advogado">Advogado subscritor</Label>
              <Input
                id="advogado"
                placeholder="Nome do(a) advogado(a) que assinará a peça"
                value={advogadoSubscritor}
                onChange={(e) => setAdvogadoSubscritor(e.target.value)}
                maxLength={150}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Anexos do processo</Label>
                <span className="text-xs text-muted-foreground">
                  PDF, DOCX e imagens · até {formatBytes(MAX_FILE_SIZE)} por arquivo
                </span>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFiles(e.dataTransfer.files);
                }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:border-accent hover:bg-accent/5"
              >
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Clique para anexar ou arraste os arquivos
                </span>
                <span className="text-xs text-muted-foreground">
                  Aceita múltiplos arquivos
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              {arquivos.length > 0 && (
                <ul className="space-y-2">
                  {arquivos.map((a) => {
                    const isImage = a.file.type.startsWith("image/");
                    return (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 rounded-md border border-border bg-background p-2"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {a.previewUrl ? (
                            <img
                              src={a.previewUrl}
                              alt={a.file.name}
                              className="h-full w-full object-cover"
                            />
                          ) : isImage ? (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {a.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(a.file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeArquivo(a.id)}
                          aria-label={`Remover ${a.file.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                  <li className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    {arquivos.length}{" "}
                    {arquivos.length === 1 ? "arquivo anexado" : "arquivos anexados"}
                  </li>
                </ul>
              )}
            </div>
          </section>

          {/* 5. Comentários */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              5. Comentários
            </h3>

            <p className="text-xs text-muted-foreground">
              Use este espaço para dar instruções adicionais ao redator. Você pode
              comentar a qualquer momento — antes, durante e após a entrega da
              petição.
            </p>

            <div className="space-y-3">
              {comentariosVisiveis.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                  Nenhum comentário ainda. Seja o primeiro a comentar.
                </p>
              ) : (
                <ul className="space-y-2">
                  {comentariosVisiveis.map((c) => {
                    const isCliente = c.autorRole === "cliente";
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "rounded-md border border-border bg-background p-3",
                          c.deletado && "opacity-60",
                        )}
                      >
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className={cn(
                                "font-semibold",
                                isCliente
                                  ? "text-[hsl(142_70%_38%)]"
                                  : "text-foreground",
                              )}
                            >
                              {c.autorNome}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(c.criadoEm, "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                            {c.deletado && (
                              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                                Excluído
                              </span>
                            )}
                          </div>
                        </div>
                        <p
                          className={cn(
                            "whitespace-pre-wrap text-sm text-foreground",
                            c.deletado && "line-through",
                          )}
                        >
                          {c.texto}
                        </p>
                        {c.deletado && c.deletadoEm && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Excluído por {c.deletadoPor} em{" "}
                            {format(c.deletadoEm, "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="novo-comentario" className="text-sm">
                Adicionar comentário como{" "}
                <span className="font-semibold text-[hsl(142_70%_38%)]">
                  {viewerNome}
                </span>
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Textarea
                  id="novo-comentario"
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Escreva um comentário..."
                  rows={3}
                  maxLength={2000}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={addComentario}
                  disabled={!novoComentario.trim()}
                  className="sm:self-end"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </div>
          </section>

          {/* 6. Upgrade Express */}
          {tipoPeticao && (
            <section className="space-y-3">
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-lg border-2 p-4 transition-colors",
                  expressUpgrade
                    ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                    : "border-border bg-muted/20",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 rounded-full p-1.5",
                        expressUpgrade ? "bg-amber-400 text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        Deseja entrega Express?{" "}
                        <span className="font-normal text-muted-foreground text-sm">
                          (até 24 horas)
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Seu pedido terá prioridade máxima e será entregue em até 24 horas.
                        Após finalizar, você será redirecionado ao checkout para pagar a taxa de entrega Express.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={expressUpgrade}
                    onCheckedChange={setExpressUpgrade}
                    disabled={!tipoPeticao}
                    id="express-toggle"
                    aria-label="Ativar entrega Express"
                  />
                </div>

                {expressUpgrade && (
                  <div className="rounded-md border border-amber-300 bg-amber-100/60 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    <strong>Atenção:</strong> ao finalizar, você será redirecionado ao pagamento da taxa de entrega Express (cobrada separadamente do seu crédito).
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 7. Resumo do pedido */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              {tipoPeticao ? "7." : "6."} Resumo do pedido
            </h3>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              {!tipoPeticao ? (
                <p className="text-sm text-muted-foreground">
                  Selecione o tipo de petição para ver o serviço e os créditos que serão consumidos.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5 border-b border-border pb-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Serviço</span>
                      <span className="font-medium text-foreground">
                        {tipoPeticao}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Modalidade</span>
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        {expressUpgrade && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                        {expressUpgrade ? "Express (24h)" : "Padrão (até 3 dias úteis)"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Créditos a consumir
                    </span>
                    <span className="font-display text-2xl font-semibold text-primary">
                      1 crédito
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm">
                    <span className="text-muted-foreground">Será debitado de</span>
                    <span className="font-medium">Créditos comuns</span>
                  </div>

                  {expressUpgrade && (
                    <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 border border-amber-200 p-2 text-sm dark:bg-amber-950/20">
                      <span className="text-muted-foreground">Taxa Express (checkout)</span>
                      <span className="font-medium text-amber-700 dark:text-amber-300">Cobrado separado</span>
                    </div>
                  )}

                  {mensagemBloqueio ? (
                    <div className="mt-4 rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
                      {mensagemBloqueio}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          navigate("/area-cliente/comprar-creditos");
                        }}
                        className="font-semibold underline underline-offset-2 hover:opacity-80"
                      >
                        Comprar agora
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Wallet className="h-4 w-4" />
                          Saldo atual
                        </span>
                        <span className="font-medium">{balance.balances.common} crédito(s)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Saldo após este pedido
                        </span>
                        <span className="font-semibold text-accent">
                          {Math.max(0, balance.balances.common - 1)} crédito(s)
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={submitting}
              className="sm:mr-auto"
            >
              Limpar tudo
            </Button>
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !tipoPeticao || !podeProceder}
              className={cn(
                expressUpgrade
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-accent text-accent-foreground hover:bg-accent/90",
              )}
            >
              {submitting
                ? "Finalizando..."
                : expressUpgrade
                ? "Finalizar e ir para o checkout Express"
                : "Finalizar pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
