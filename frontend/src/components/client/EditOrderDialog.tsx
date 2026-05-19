import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarIcon,
  Download,
  Edit3,
  Eye,
  Loader2,
  Save,
  UploadCloud,
  X,
  UserRound,
  Paperclip,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { api, ApiError, type UploadedDocument } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Separator } from "@/components/ui/separator";
import { type ClientOrder } from "@/lib/api";

function DocumentDownloadRow({ doc }: { doc: UploadedDocument }) {
  const [busy, setBusy] = useState(false);
  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.documents.download(doc);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 403
            ? "Você não tem permissão para baixar este documento."
            : err.status === 404
              ? "Documento não encontrado."
              : err.message
          : "Não foi possível baixar o documento. Tente novamente.";
      toast({ title: "Falha no download", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-center gap-3 rounded-md bg-secondary/50 px-3 py-2">
      <Paperclip className="h-4 w-4 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{doc.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {doc.size_label}
          {doc.created_at ? ` · ${format(parseISO(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}` : ""}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={busy}
        aria-label={`Baixar ${doc.file_name}`}
        title={`Baixar ${doc.file_name}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </li>
  );
}

const AREAS_DIREITO = [
  "Direito Civil",
  "Direito Empresarial",
  "Direito do Trabalho",
  "Direito Tributário",
  "Direito Previdenciário",
  "Direito Administrativo",
  "Direito Penal",
  "Direito de Família",
  "Direito do Consumidor",
  "Direito Ambiental",
];

const TIPOS_PETICAO = {
  "PETIÇÕES INICIAIS": [
    "Petição inicial comum",
    "Petição inicial cumulada",
    "Petição inicial com tutela de urgência",
    "Petição inicial com antecipação de tutela",
    "Mandado de segurança",
    "Mandado de injunção",
    "Habeas corpus",
    "Habeas data",
    "Reintegração de posse",
    "Busca e apreensão",
    "Exibição",
    "Produção antecipada de provas",
    "Arresto",
    "Sequestro",
    "Penhora",
    "Caução",
  ],
  RECURSOS: [
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

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pendente: {
    label: "Pendente",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  em_andamento: {
    label: "Em andamento",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  concluido: {
    label: "Concluído",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

interface EditOrderDialogProps {
  order: ClientOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Record<string, unknown>) => void;
  /** Upload de novos comprovantes para o pedido. Resolve com a lista
   *  atualizada (ou void quando o pai vai refetch). */
  onUploadDocuments?: (files: File[]) => Promise<void>;
  isSubmitting?: boolean;
}

export function EditOrderDialog({
  order,
  open,
  onOpenChange,
  onSave,
  onUploadDocuments,
  isSubmitting,
}: EditOrderDialogProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (event.target) event.target.value = "";
    if (!files.length || !onUploadDocuments) return;
    setUploading(true);
    try {
      await onUploadDocuments(files);
    } finally {
      setUploading(false);
    }
  };
  const petition = order?.petition ?? null;
  const canEdit = order?.status === "pendente";
  const statusCfg = order ? (STATUS_CONFIG[order.status] ?? null) : null;

  const initialForm = useMemo(() => ({
    deadline_at: order?.deadline_at ? parseISO(order.deadline_at) : undefined as Date | undefined,
    area_direito: petition?.area_direito || "",
    tipo_peticao: petition?.tipo_peticao || "",
    numero_processo: petition?.numero_processo || "",
    data_publicacao: petition?.data_publicacao ? parseISO(petition.data_publicacao) : undefined as Date | undefined,
    advogado_subscritor: petition?.advogado_subscritor || "",
    resumo_caso: petition?.resumo_caso || "",
    detalhes: petition?.detalhes || "",
    justica_gratuita: petition?.justica_gratuita ? "sim" : "nao",
    tutela_urgencia: petition?.tutela_urgencia ? "sim" : "nao",
  }), [petition, order]);

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    setFormData(initialForm);
  }, [initialForm]);

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const data: Record<string, unknown> = {};
    if (formData.deadline_at) data.deadline_at = (formData.deadline_at as Date).toISOString();
    if (petition) {
      if (formData.area_direito !== (petition.area_direito || "")) data.area_direito = formData.area_direito;
      if (formData.tipo_peticao !== (petition.tipo_peticao || "")) data.tipo_peticao = formData.tipo_peticao;
      if (formData.numero_processo !== (petition.numero_processo || "")) data.numero_processo = formData.numero_processo;
      if (formData.data_publicacao) {
        const orig = petition.data_publicacao ? parseISO(petition.data_publicacao) : undefined;
        if (!orig || formData.data_publicacao.getTime() !== orig.getTime())
          data.data_publicacao = (formData.data_publicacao as Date).toISOString();
      }
      if (formData.advogado_subscritor !== (petition.advogado_subscritor || "")) data.advogado_subscritor = formData.advogado_subscritor;
      if (formData.resumo_caso !== (petition.resumo_caso || "")) data.resumo_caso = formData.resumo_caso;
      if (formData.detalhes !== (petition.detalhes || "")) data.detalhes = formData.detalhes;
      if (formData.justica_gratuita !== (petition.justica_gratuita ? "sim" : "nao")) data.justica_gratuita = formData.justica_gratuita === "sim";
      if (formData.tutela_urgencia !== (petition.tutela_urgencia ? "sim" : "nao")) data.tutela_urgencia = formData.tutela_urgencia === "sim";
    }
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {/* ── Cabeçalho ── */}
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
                {canEdit
                  ? <><Edit3 className="h-5 w-5" /> Editar pedido</>
                  : <><Eye className="h-5 w-5" /> Detalhes do pedido</>
                }
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {order?.reference} — {order?.service_type}
              </p>
            </div>
            {statusCfg && (
              <Badge variant="outline" className={cn("flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium", statusCfg.className)}>
                {statusCfg.icon}
                {order?.status_label ?? statusCfg.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-8 pt-2">

          {/* ── Informações gerais ── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Informações do pedido
            </h3>

            {canEdit ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prazo de entrega</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.deadline_at && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.deadline_at ? format(formData.deadline_at, "PPP", { locale: ptBR }) : "Escolha uma data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={formData.deadline_at} onSelect={(d) => handleChange("deadline_at", d)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <InfoField label="Referência" value={order?.reference} />
                <InfoField label="Valor" value={order?.total_brl} />
                <InfoField
                  label="Prazo de entrega"
                  value={order?.deadline_at ? format(parseISO(order.deadline_at), "dd/MM/yyyy", { locale: ptBR }) : undefined}
                />
                <InfoField
                  label="Data do pedido"
                  value={order?.created_at ? format(parseISO(order.created_at), "dd/MM/yyyy", { locale: ptBR }) : undefined}
                />
              </div>
            )}
          </section>

          {/* ── Dados da petição ── */}
          {petition && (
            <>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados da petição
                </h3>

                {canEdit ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="area_direito">Área do Direito <span className="text-destructive">*</span></Label>
                      <Select value={formData.area_direito} onValueChange={(v) => handleChange("area_direito", v)}>
                        <SelectTrigger id="area_direito"><SelectValue placeholder="Selecione uma área" /></SelectTrigger>
                        <SelectContent>
                          {AREAS_DIREITO.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo_peticao">Tipo de petição</Label>
                      <Select value={formData.tipo_peticao} onValueChange={(v) => handleChange("tipo_peticao", v)}>
                        <SelectTrigger id="tipo_peticao"><SelectValue placeholder="Selecione um tipo" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPOS_PETICAO).map(([grupo, tipos]) => (
                            <div key={grupo}>
                              <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">{grupo}</p>
                              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="numero_processo">Número do processo</Label>
                      <Input id="numero_processo" placeholder="0000000-00.0000.0.00.0000" value={formData.numero_processo} onChange={(e) => handleChange("numero_processo", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Data da publicação</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.data_publicacao && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.data_publicacao ? format(formData.data_publicacao, "PPP", { locale: ptBR }) : "Escolha uma data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={formData.data_publicacao} onSelect={(d) => handleChange("data_publicacao", d)} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="advogado_subscritor">Advogado subscritor</Label>
                      <Input id="advogado_subscritor" placeholder="Nome do(a) advogado(a) que assinará a peça" value={formData.advogado_subscritor} onChange={(e) => handleChange("advogado_subscritor", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Justiça gratuita?</Label>
                      <RadioGroup value={formData.justica_gratuita} onValueChange={(v) => handleChange("justica_gratuita", v)} className="flex gap-6">
                        <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="jg-sim" /><Label htmlFor="jg-sim" className="font-normal">Sim</Label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="jg-nao" /><Label htmlFor="jg-nao" className="font-normal">Não</Label></div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label>Tutela de urgência?</Label>
                      <RadioGroup value={formData.tutela_urgencia} onValueChange={(v) => handleChange("tutela_urgencia", v)} className="flex gap-6">
                        <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="tu-sim" /><Label htmlFor="tu-sim" className="font-normal">Sim</Label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="tu-nao" /><Label htmlFor="tu-nao" className="font-normal">Não</Label></div>
                      </RadioGroup>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoField label="Área do Direito" value={petition.area_direito} />
                    <InfoField label="Tipo de petição" value={petition.tipo_peticao} />
                    <InfoField label="Número do processo" value={petition.numero_processo} />
                    <InfoField label="Data da publicação" value={petition.data_publicacao ? format(parseISO(petition.data_publicacao), "dd/MM/yyyy", { locale: ptBR }) : undefined} />
                    <InfoField label="Advogado subscritor" value={petition.advogado_subscritor} />
                    <InfoField label="Justiça gratuita" value={petition.justica_gratuita ? "Sim" : "Não"} />
                    <InfoField label="Tutela de urgência" value={petition.tutela_urgencia ? "Sim" : "Não"} />
                  </div>
                )}
              </section>

              {/* ── Resumo e detalhes ── */}
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Informações sobre o caso
                </h3>

                {canEdit && (
                  <div className="flex gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Você pode anexar comprovantes adicionais ao seu pedido na seção
                      <strong> Documentos enviados </strong> abaixo.</p>
                  </div>
                )}

                {canEdit ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="resumo_caso">Resumo do caso</Label>
                      <Textarea id="resumo_caso" placeholder="Descreva brevemente o objeto do processo" value={formData.resumo_caso} onChange={(e) => handleChange("resumo_caso", e.target.value)} rows={4} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="detalhes">Detalhes adicionais</Label>
                      <Textarea id="detalhes" placeholder="Liste os tópicos, pedidos e teses que devem constar na petição" value={formData.detalhes} onChange={(e) => handleChange("detalhes", e.target.value)} rows={4} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumo do caso</p>
                      <p className="text-sm leading-relaxed text-foreground">{petition.resumo_caso || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detalhes adicionais</p>
                      <p className="text-sm leading-relaxed text-foreground">{petition.detalhes || "—"}</p>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Partes ── */}
              {!!petition.partes?.length && (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Partes</h3>
                    <ul className="grid gap-2">
                      {petition.partes.map((parte, i) => (
                        <li key={`${parte.nome}-${i}`} className="flex items-center gap-3 rounded-md bg-secondary/50 px-3 py-2">
                          <UserRound className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{parte.nome}</p>
                            <p className="text-xs text-muted-foreground">{parte.tipo}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}

              {/* ── Documentos ── */}
              <Separator />
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Documentos enviados
                  </h3>
                  {canEdit && onUploadDocuments && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFilesPicked}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || isSubmitting}
                      >
                        {uploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="mr-2 h-4 w-4" />
                        )}
                        {uploading ? "Enviando..." : "Adicionar comprovantes"}
                      </Button>
                    </>
                  )}
                </div>
                {petition.documents?.length ? (
                  <ul className="grid gap-2">
                    {petition.documents.map((doc) => (
                      <DocumentDownloadRow key={doc.id} doc={doc} />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-3 text-center text-xs text-muted-foreground">
                    Nenhum documento anexado ainda.
                    {canEdit && onUploadDocuments && " Clique em 'Adicionar comprovantes' para enviar."}
                  </p>
                )}
                {petition.documents?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Clique no ícone de download para baixar o arquivo original.
                  </p>
                ) : null}
              </section>
            </>
          )}

          {!petition && (
            <div className="rounded-md border border-border bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-6 w-6" />
              <p>Este pedido não possui petição vinculada.</p>
              {canEdit && <p className="mt-1">Somente o prazo de entrega pode ser editado.</p>}
            </div>
          )}

          {/* ── Ações ── */}
          <Separator />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" />
              {canEdit ? "Cancelar" : "Fechar"}
            </Button>
            {canEdit && (
              <Button type="button" onClick={handleSave} disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
