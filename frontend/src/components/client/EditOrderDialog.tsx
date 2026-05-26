import { useRef, useState } from "react";
import {
  Download,
  Eye,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  UploadCloud,
  X,
  UserRound,
  Paperclip,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { api, ApiError, type UploadedDocument, type OrderComment } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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

function CommentItem({
  comment,
  onDelete,
  deleting,
}: {
  comment: OrderComment;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const isClient = comment.author_role === "client";
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={cn("font-semibold", isClient ? "text-[hsl(142_70%_38%)]" : "text-foreground")}>
            {comment.author_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(parseISO(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
        {isClient && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(comment.id)}
            disabled={deleting}
            title="Excluir comentário"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{comment.text}</p>
    </li>
  );
}

interface EditOrderDialogProps {
  order: ClientOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadDocuments?: (files: File[]) => Promise<void>;
}

export function EditOrderDialog({
  order,
  open,
  onOpenChange,
  onUploadDocuments,
}: EditOrderDialogProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const petition = order?.petition ?? null;
  const statusCfg = order ? (STATUS_CONFIG[order.status] ?? null) : null;

  const commentsQuery = useQuery({
    queryKey: ["order-comments", order?.id],
    queryFn: () => api.clientArea.listComments(order!.id),
    enabled: open && !!order,
    select: (data) => data.comments,
  });

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => api.clientArea.addComment(order!.id, text),
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["order-comments", order?.id] });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Não foi possível enviar o comentário.";
      toast({ title: "Erro ao comentar", description: msg, variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => api.clientArea.deleteComment(order!.id, commentId),
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["order-comments", order?.id] });
    },
    onError: (err) => {
      setDeletingId(null);
      const msg = err instanceof ApiError ? err.message : "Não foi possível excluir o comentário.";
      toast({ title: "Erro ao excluir", description: msg, variant: "destructive" });
    },
  });

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

  const handleSendComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    addCommentMutation.mutate(trimmed);
  };

  const handleDeleteComment = (commentId: number) => {
    setDeletingId(commentId);
    deleteCommentMutation.mutate(commentId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {/* ── Cabeçalho ── */}
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
                <Eye className="h-5 w-5" /> Detalhes do pedido
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
          </section>

          {/* ── Dados da petição ── */}
          {petition && (
            <>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados da petição
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoField label="Área do Direito" value={petition.area_direito} />
                  <InfoField label="Tipo de petição" value={petition.tipo_peticao} />
                  <InfoField label="Número do processo" value={petition.numero_processo} />
                  <InfoField
                    label="Data da publicação"
                    value={petition.data_publicacao ? format(parseISO(petition.data_publicacao), "dd/MM/yyyy", { locale: ptBR }) : undefined}
                  />
                  <InfoField label="Advogado subscritor" value={petition.advogado_subscritor} />
                  <InfoField label="Justiça gratuita" value={petition.justica_gratuita ? "Sim" : "Não"} />
                  <InfoField label="Tutela de urgência" value={petition.tutela_urgencia ? "Sim" : "Não"} />
                </div>
              </section>

              {/* ── Resumo e detalhes ── */}
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Informações sobre o caso
                </h3>
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
              </section>

              {/* ── Partes ── */}
              <Separator />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Partes do processo
                </h3>
                {!petition.partes?.length ? (
                  <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-3 text-center text-xs text-muted-foreground">
                    Nenhuma parte cadastrada.
                  </p>
                ) : (
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
                )}
              </section>

              {/* ── Documentos ── */}
              <Separator />
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Documentos enviados
                  </h3>
                  {onUploadDocuments && order?.status !== "cancelado" && (
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
                        disabled={uploading}
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
                  <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
                )}
                {onUploadDocuments && order?.status !== "cancelado" && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !uploading) {
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files ?? []);
                      if (!files.length || uploading || !onUploadDocuments) return;
                      setUploading(true);
                      onUploadDocuments(files).finally(() => setUploading(false));
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-border bg-secondary/30 p-6 text-center text-sm transition-colors",
                      uploading ? "opacity-60" : "hover:border-primary hover:bg-secondary/50",
                    )}
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <UploadCloud className="h-6 w-6 text-primary" />
                    )}
                    <p className="font-medium text-foreground">
                      {uploading ? "Enviando arquivos..." : "Clique para anexar ou arraste os arquivos"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOCX e imagens · até 50 MB por arquivo · múltiplos arquivos
                    </p>
                  </div>
                )}
              </section>
            </>
          )}

          {!petition && (
            <div className="rounded-md border border-border bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-6 w-6" />
              <p>Este pedido não possui petição vinculada.</p>
            </div>
          )}

          {/* ── Comentários ── */}
          <Separator />
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Comentários
            </h3>

            {commentsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando comentários…
              </div>
            ) : commentsQuery.data?.length ? (
              <ul className="grid gap-2">
                {commentsQuery.data.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    onDelete={handleDeleteComment}
                    deleting={deletingId === c.id && deleteCommentMutation.isPending}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum comentário ainda. Use o campo abaixo para adicionar uma observação.
              </p>
            )}

            {order?.status !== "cancelado" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Use este espaço para dar instruções adicionais ao redator. Você pode comentar a qualquer momento.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSendComment();
                    }}
                    placeholder="Escreva um comentário..."
                    rows={3}
                    maxLength={5000}
                    className="flex-1"
                    disabled={addCommentMutation.isPending}
                  />
                  <Button
                    type="button"
                    onClick={handleSendComment}
                    disabled={!commentText.trim() || addCommentMutation.isPending}
                    className="sm:self-end"
                  >
                    {addCommentMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* ── Ações ── */}
          <Separator />
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
