import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  calcularPrecoPedido,
  formatBRL,
  useUserPricingProfile,
  type Modalidade,
} from "@/lib/pricing";
import {
  AlertCircle,
  CalendarIcon,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Send,
  Trash2,
  UploadCloud,
  Wallet,
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

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB por arquivo
const ACCEPTED_TYPES =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";

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

  // Valor do pedido (mock — em produção pode variar por tipo/área)
  const valorPedido = 1;
  const { data: balanceData } = useQuery({
    queryKey: ["balance"],
    queryFn: () => api.me.balance(),
  });
  const saldoAtual = balanceData?.credits_available ?? 0;
  const saldoApos = saldoAtual - valorPedido;
  const semSaldo = saldoAtual < valorPedido;

  // Mock: papel de quem está visualizando o modal. Trocar por contexto/auth real depois.
  const [viewerRole, setViewerRole] = useState<CommentAuthorRole>("cliente");
  const viewerNome = viewerRole === "cliente" ? "Você (Cliente)" : "Equipe (Redator)";
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [mostrarDeletados, setMostrarDeletados] = useState(false);

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

  const deletarComentario = (id: string) => {
    if (viewerRole !== "redator") return;
    setComentarios((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, deletado: true, deletadoEm: new Date(), deletadoPor: viewerNome }
          : c,
      ),
    );
  };

  const comentariosVisiveis = comentarios.filter((c) => {
    if (c.deletado) {
      // Cliente nunca vê deletados; redator pode optar por ver no histórico interno.
      return viewerRole === "redator" && mostrarDeletados;
    }
    return true;
  });

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
    setMostrarDeletados(false);
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

    if (semSaldo) {
      toast({
        title: "Saldo insuficiente",
        description: "Adicione créditos para finalizar o pedido.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let documentIds: number[] = [];
      if (arquivos.length > 0) {
        const uploadRes = await api.documents.upload(arquivos.map((a) => a.file));
        documentIds = uploadRes.documents.map((d) => d.id);
      }

      await api.petitions.create({
        area_direito: areaDireito,
        tipo_peticao: tipoPeticao,
        numero_processo: numeroProcesso,
        data_publicacao: dataPublicacao ? format(dataPublicacao, "yyyy-MM-dd") : "",
        justica_gratuita: justicaGratuita === "sim",
        tutela_urgencia: tutelaUrgencia === "sim",
        advogado_subscritor: advogadoSubscritor,
        resumo_caso: resumoCaso,
        detalhes,
        partes: partes.map((p) => ({ nome: p.nome, tipo: p.tipo })),
        document_ids: documentIds,
      });

      queryClient.invalidateQueries({ queryKey: ["petitions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });

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
              <Select value={tipoPeticao} onValueChange={setTipoPeticao}>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">
                5. Comentários
              </h3>
              {/* Mock toggle de papel — substituir por contexto de auth real */}
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewerRole("cliente")}
                  className={cn(
                    "rounded px-2 py-1 transition-colors",
                    viewerRole === "cliente"
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Ver como Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setViewerRole("redator")}
                  className={cn(
                    "rounded px-2 py-1 transition-colors",
                    viewerRole === "redator"
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Ver como Redator
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Cliente e redator podem comentar a qualquer momento — antes,
              durante e após a entrega da petição. Apenas o redator pode
              excluir comentários; o histórico completo, inclusive excluídos,
              fica disponível internamente para a equipe.
            </p>

            {viewerRole === "redator" && comentarios.some((c) => c.deletado) && (
              <button
                type="button"
                onClick={() => setMostrarDeletados((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {mostrarDeletados ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    Ocultar comentários excluídos
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Mostrar histórico (inclui excluídos)
                  </>
                )}
              </button>
            )}

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
                          {viewerRole === "redator" && !c.deletado && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => deletarComentario(c.id)}
                              aria-label="Excluir comentário"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
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
                <span
                  className={cn(
                    "font-semibold",
                    viewerRole === "cliente"
                      ? "text-[hsl(142_70%_38%)]"
                      : "text-foreground",
                  )}
                >
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

          {/* 6. Resumo do pedido */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              6. Resumo do pedido
            </h3>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Valor deste pedido
                </span>
                <span className="font-display text-2xl font-semibold text-primary">
                  R$ {valorPedido.toFixed(2).replace(".", ",")}
                </span>
              </div>

              {semSaldo ? (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Você está sem saldo.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/area-cliente/saldos");
                    }}
                    className="font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    Clique aqui para adicionar mais saldo
                  </button>
                  .
                </div>
              ) : (
                <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      Saldo atual
                    </span>
                    <span className="font-medium">
                      R$ {saldoAtual.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Saldo após o débito
                    </span>
                    <span className="font-semibold text-accent">
                      R$ {saldoApos.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || semSaldo}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {submitting ? "Finalizando..." : "Finalizar pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
