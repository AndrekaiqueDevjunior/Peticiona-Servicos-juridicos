import { useMemo, useRef, useState } from "react";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CalendarIcon,
  FileText,
  Filter,
  Paperclip,
  Search,
  Send,
  UploadCloud,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import {
  STATUS_BADGE,
  STATUS_DOT,
  STATUS_LABEL,
  adicionarAnexosCliente,
  adicionarComentario,
  usePedidos,
  type Pedido,
  type PedidoStatus,
} from "@/lib/pedidos";

const STATUS_OPTIONS: { value: PedidoStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos os status" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_dados", label: "Aguardando dados" },
  { value: "concluido", label: "Concluído" },
];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

export default function Orders() {
  const { pedidos } = usePedidos();
  const [statusFiltro, setStatusFiltro] = useState<PedidoStatus | "todos">(
    "todos",
  );
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(
    null,
  );

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (statusFiltro !== "todos" && p.status !== statusFiltro) return false;
      if (dataInicio || dataFim) {
        const created = parseISO(p.criadoEmISO);
        const start = dataInicio ? startOfDay(dataInicio) : new Date(0);
        const end = dataFim ? endOfDay(dataFim) : new Date(8.64e15);
        if (!isWithinInterval(created, { start, end })) return false;
      }
      return true;
    });
  }, [pedidos, statusFiltro, dataInicio, dataFim]);

  const aguardandoDadosCount = useMemo(
    () => pedidos.filter((p) => p.status === "aguardando_dados").length,
    [pedidos],
  );

  const limparFiltros = () => {
    setStatusFiltro("todos");
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const filtrosAtivos =
    statusFiltro !== "todos" || dataInicio || dataFim ? true : false;

  // Mantém o pedido selecionado sincronizado com o store (comentários/anexos novos).
  const pedidoModal = pedidoSelecionado
    ? pedidos.find((p) => p.id === pedidoSelecionado.id) ?? null
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Meus pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe todas as suas solicitações jurídicas.
          </p>
        </div>
      </div>

      {aguardandoDadosCount > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              {aguardandoDadosCount === 1
                ? "1 pedido aguardando seus dados"
                : `${aguardandoDadosCount} pedidos aguardando seus dados`}
            </p>
            <p className="text-foreground/80">
              Nossa equipe precisa de informações adicionais. Abra o pedido
              para ver o que falta e responder via comentários.
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={statusFiltro}
              onValueChange={(v) => setStatusFiltro(v as PedidoStatus | "todos")}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Data inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-[170px] justify-start text-left font-normal",
                    !dataInicio && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio
                    ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR })
                    : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Data final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-[170px] justify-start text-left font-normal",
                    !dataFim && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim
                    ? format(dataFim, "dd/MM/yyyy", { locale: ptBR })
                    : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {filtrosAtivos && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="h-9"
            >
              <X className="mr-1 h-4 w-4" />
              Limpar
            </Button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {pedidosFiltrados.length} de {pedidos.length}{" "}
            {pedidos.length === 1 ? "pedido" : "pedidos"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pedidos.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido ainda. Use o botão "Novo pedido" para começar.
            </p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido corresponde aos filtros selecionados.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pedidosFiltrados.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-secondary p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {p.tipoPeticao
                          ? `${p.tipoPeticao} — ${p.areaDireito}`
                          : p.areaDireito}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.reference}
                        {p.numeroProcesso ? ` · ${p.numeroProcesso}` : ""}
                        {" · "}
                        {format(parseISO(p.criadoEmISO), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                        STATUS_BADGE[p.status],
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          STATUS_DOT[p.status],
                        )}
                      />
                      {STATUS_LABEL[p.status]}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPedidoSelecionado(p)}
                      aria-label={`Ver detalhes do pedido ${p.reference}`}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PedidoDetailsDialog
        pedido={pedidoModal}
        onClose={() => setPedidoSelecionado(null)}
      />
    </div>
  );
}

interface DetailsProps {
  pedido: Pedido | null;
  onClose: () => void;
}

function PedidoDetailsDialog({ pedido, onClose }: DetailsProps) {
  const [comentario, setComentario] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!pedido) return null;

  const enviarComentario = () => {
    const t = comentario.trim();
    if (!t) return;
    adicionarComentario(pedido.id, t, "cliente", "Você");
    setComentario("");
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    adicionarAnexosCliente(pedido.id, Array.from(files));
    toast({
      title: "Anexo enviado",
      description: `${files.length} arquivo(s) adicionado(s) ao pedido.`,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Timeline cronológica de comentários + anexos.
  type TimelineItem =
    | { kind: "comentario"; dataISO: string; data: Pedido["comentarios"][number] }
    | {
        kind: "anexo";
        dataISO: string;
        data: Pedido["anexosCliente"][number];
      };

  const timeline: TimelineItem[] = [
    ...pedido.comentarios.map((c) => ({
      kind: "comentario" as const,
      dataISO: c.dataISO,
      data: c,
    })),
    ...pedido.anexosCliente.map((a) => ({
      kind: "anexo" as const,
      dataISO: a.dataISO,
      data: a,
    })),
  ].sort((a, b) => a.dataISO.localeCompare(b.dataISO));

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            Pedido {pedido.reference}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                STATUS_BADGE[pedido.status],
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[pedido.status])} />
              {STATUS_LABEL[pedido.status]}
            </span>
          </DialogTitle>
          <DialogDescription>
            Criado em {formatDateTime(pedido.criadoEmISO)}. Os dados abaixo são
            somente leitura — você pode adicionar comentários e anexos
            complementares.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo do serviço */}
          <ReadonlySection title="Serviço">
            <ReadonlyField label="Modalidade" value={pedido.modalidadeLabel} />
            <ReadonlyField label="Valor" value={formatBRL(pedido.valor)} />
          </ReadonlySection>

          {/* 1. Solicitação */}
          <ReadonlySection title="1. Dados da solicitação">
            <ReadonlyField label="Área do Direito" value={pedido.areaDireito} />
            <ReadonlyField
              label="Tipo de petição"
              value={pedido.tipoPeticao || "—"}
            />
          </ReadonlySection>

          {/* 2. Processo */}
          <ReadonlySection title="2. Dados do processo">
            <ReadonlyField
              label="Data da publicação"
              value={
                pedido.dataPublicacao
                  ? format(parseISO(pedido.dataPublicacao), "dd/MM/yyyy", {
                      locale: ptBR,
                    })
                  : "—"
              }
            />
            <ReadonlyField
              label="Número do processo"
              value={pedido.numeroProcesso || "—"}
            />
            <ReadonlyField
              label="Competência"
              value={pedido.competencia || "—"}
            />
            <ReadonlyField label="Comarca" value={pedido.comarca || "—"} />
            <ReadonlyField
              label="Justiça gratuita"
              value={pedido.justicaGratuita ? "Sim" : "Não"}
            />
            <ReadonlyField
              label="Tutela de urgência"
              value={pedido.tutelaUrgencia ? "Sim" : "Não"}
            />
          </ReadonlySection>

          {/* 3. Partes */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              3. Partes do processo
            </h3>
            {pedido.partes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma parte cadastrada.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {pedido.partes.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{p.nome || "—"}</span>
                    <span className="text-muted-foreground">{p.tipo || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 4. Caso */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              4. Informações sobre o caso
            </h3>
            <ReadonlyTextarea
              label="Resumo"
              value={pedido.resumoCaso || "—"}
            />
            <ReadonlyTextarea
              label="Tópicos imprescindíveis"
              value={pedido.detalhes || "—"}
            />
            <ReadonlyField
              label="Advogado subscritor"
              value={pedido.advogadoSubscritor || "—"}
            />
          </section>

          {/* 5. Anexos originais */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              5. Anexos enviados na criação
            </h3>
            {pedido.anexosOriginais.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum anexo enviado.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {pedido.anexosOriginais.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate text-foreground">
                      {a.nome}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(a.tamanho)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 6. Interação cliente */}
          <section className="space-y-3 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground">
              Comentários e anexos complementares
            </h3>
            <p className="text-xs text-muted-foreground">
              Registrados em ordem cronológica com data e hora.
            </p>

            {timeline.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Nada por aqui ainda. Adicione um comentário ou anexo abaixo.
              </p>
            ) : (
              <ul className="space-y-2">
                {timeline.map((item) => {
                  if (item.kind === "comentario") {
                    const c = item.data;
                    const isCliente = c.autor === "cliente";
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "rounded-md border p-3 text-sm",
                          isCliente
                            ? "border-primary/20 bg-primary/5"
                            : "border-accent/30 bg-accent/10",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {c.autorNome}
                          </span>
                          <span>{formatDateTime(c.dataISO)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-foreground">
                          {c.texto}
                        </p>
                      </li>
                    );
                  }
                  const a = item.data;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-foreground">
                        {a.nome}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(a.tamanho)} ·{" "}
                        {formatDateTime(a.dataISO)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Adicionar comentário */}
            <div className="space-y-2">
              <Label htmlFor="novo-comentario">Adicionar comentário</Label>
              <Textarea
                id="novo-comentario"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escreva sua mensagem para a equipe..."
                rows={3}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Anexar arquivos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={enviarComentario}
                  disabled={!comentario.trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar comentário
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReadonlySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
        {value}
      </div>
    </div>
  );
}

function ReadonlyTextarea({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
        {value}
      </div>
    </div>
  );
}
