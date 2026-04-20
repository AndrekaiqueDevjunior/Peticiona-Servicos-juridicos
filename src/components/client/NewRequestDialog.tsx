import { useRef, useState } from "react";
import {
  AlertCircle,
  CalendarIcon,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Send,
  Trash2,
  UploadCloud,
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
  "Cível",
  "Trabalhista",
  "Penal",
  "Família",
  "Tributário",
  "Previdenciário",
  "Consumidor",
  "Empresarial",
  "Administrativo",
  "Constitucional",
];

const TIPOS_PETICAO = [
  "Petição Inicial",
  "Contestação",
  "Réplica",
  "Recurso",
  "Embargos",
  "Agravo",
  "Manifestação",
  "Memoriais",
  "Apelação",
];

const TIPOS_PARTE = [
  "Autor",
  "Réu",
  "Reclamante",
  "Reclamado",
  "Exequente",
  "Executado",
  "Terceiro Interessado",
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
  const [areaDireito, setAreaDireito] = useState("");
  const [tipoPeticao, setTipoPeticao] = useState("");
  const [dataPublicacao, setDataPublicacao] = useState<Date | undefined>();
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [justicaGratuita, setJusticaGratuita] = useState("nao");
  const [partes, setPartes] = useState<Parte[]>([
    { id: crypto.randomUUID(), nome: "", tipo: "" },
  ]);
  const [resumoCaso, setResumoCaso] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [tutelaUrgencia, setTutelaUrgencia] = useState("nao");
  const [advogadoSubscritor, setAdvogadoSubscritor] = useState("");
  const [arquivos, setArquivos] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setJusticaGratuita("nao");
    setPartes([{ id: crypto.randomUUID(), nome: "", tipo: "" }]);
    setResumoCaso("");
    setDetalhes("");
    setTutelaUrgencia("nao");
    setAdvogadoSubscritor("");
    arquivos.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setArquivos([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaDireito) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione a área do Direito.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Solicitação enviada",
      description: "Sua nova solicitação foi registrada com sucesso.",
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova solicitação</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para criar uma nova solicitação de petição.
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
                  {TIPOS_PETICAO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
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

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Enviar solicitação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
