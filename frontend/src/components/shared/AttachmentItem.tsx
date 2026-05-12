import { Download, FileArchive, FileImage, FileSpreadsheet, FileText, FileType, File as FileIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadAnexoMock } from "@/lib/anexoDownload";

export interface AttachmentItemProps {
  nome: string;
  tamanho: number;
  /** ISO opcional — quando ausente, exibe apenas o autor. */
  dataISO?: string;
  /** Texto curto do remetente, ex.: "Enviado pelo cliente". */
  enviadoPor?: string;
  /** Tipo MIME (opcional, usado para gerar o blob simulado). */
  mime?: string;
  className?: string;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

const iconForFile = (nome: string) => {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return FileType;
  if (["doc", "docx", "rtf", "odt", "txt"].includes(ext)) return FileText;
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return FileSpreadsheet;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return FileImage;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive;
  return FileIcon;
};

const iconColorForFile = (nome: string) => {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "text-destructive";
  if (["doc", "docx"].includes(ext)) return "text-primary";
  if (["xls", "xlsx", "csv"].includes(ext)) return "text-accent";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return "text-accent";
  return "text-muted-foreground";
};

export function AttachmentItem({
  nome,
  tamanho,
  dataISO,
  enviadoPor,
  mime,
  className,
}: AttachmentItemProps) {
  const Icon = iconForFile(nome);
  const iconColor = iconColorForFile(nome);

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm",
        className,
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{nome}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatBytes(tamanho)}
          {enviadoPor ? ` · ${enviadoPor}` : ""}
          {dataISO ? ` · ${formatDateTime(dataISO)}` : ""}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => downloadAnexoMock(nome, mime)}
        aria-label={`Baixar ${nome}`}
      >
        <Download className="mr-1.5 h-4 w-4" />
        Baixar
      </Button>
    </li>
  );
}
