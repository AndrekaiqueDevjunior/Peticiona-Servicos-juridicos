import { useMemo, useRef, useState } from "react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  FileText,
  Inbox,
  Paperclip,
  Search,
  Send,
  UploadCloud,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  STATUS_BADGE,
  STATUS_DOT,
  STATUS_LABEL,
  adicionarComentario,
  adicionarEntregaFinal,
  atualizarStatus,
  usePedidos,
  type Pedido,
  type PedidoStatus,
} from "@/lib/pedidos";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const tipoCompleto = (p: Pedido) => {
  const partes = ["Petição", p.areaDireito, p.tipoPeticao].filter(Boolean);
  return partes.join(" → ");
};

export default function StaffOrders() {
  const { pedidos } = usePedidos();
  const [selecionado, setSelecionado] = useState<Pedido | null>(null);

  const ordenados = useMemo(
    () => [...pedidos].sort((a, b) => a.prazoEntregaInternoISO.localeCompare(b.prazoEntregaInternoISO)),
    [pedidos],
  );

  const pedidoModal = selecionado
    ? pedidos.find((p) => p.id === selecionado.id) ?? null
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Bandeja de pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fila de serviços vinculados a você. Trabalhe pelo prazo interno.
          </p>
        </div>
        <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"} na bandeja
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Fila de serviços</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ordenados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">Nenhum pedido na bandeja ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {ordenados.map((p) => {
                const prazoInternoDate = parseISO(p.prazoEntregaInternoISO);
                const horasRestantes =
                  (prazoInternoDate.getTime() - Date.now()) / (1000 * 60 * 60);
                const diasRestantes = differenceInCalendarDays(
                  prazoInternoDate,
                  new Date(),
                );
                const concluido = p.status === "concluido";
                const atrasado = horasRestantes < 0 && !concluido;
                // Vencendo em menos de 12h — destaque vermelho.
                const critico = !concluido && horasRestantes >= 0 && horasRestantes < 12;
                const urgente =
                  !concluido && horasRestantes >= 12 && diasRestantes <= 1;

                let cor = "text-muted-foreground";
                if (atrasado || critico) cor = "text-destructive font-semibold";
                else if (urgente) cor = "text-accent";

                let sufixo: string;
                if (atrasado) {
                  sufixo = ` · atrasado ${Math.abs(Math.floor(horasRestantes))}h`;
                } else if (critico) {
                  sufixo = ` · vence em ${Math.max(1, Math.floor(horasRestantes))}h`;
                } else {
                  sufixo = ` · em ${diasRestantes}d`;
                }

                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between",
                      (atrasado || critico) && "bg-destructive/5",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-secondary p-2">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          Nº {p.numero} · {tipoCompleto(p)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Cliente: prazo {format(parseISO(p.prazoEntregaClienteISO), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {p.numeroProcesso ? ` · Proc. ${p.numeroProcesso}` : ""}
                        </p>
                        <p className={cn("mt-1 inline-flex items-center gap-1 text-xs", cor)}>
                          <CalendarClock className="h-3.5 w-3.5" />
                          Entrega interna:{" "}
                          {format(prazoInternoDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {!concluido && sufixo}
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
                        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[p.status])} />
                        {STATUS_LABEL[p.status]}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelecionado(p)}
                        aria-label={`Ver detalhes do pedido ${p.numero}`}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <StaffPedidoDialog pedido={pedidoModal} onClose={() => setSelecionado(null)} />
    </div>
  );
}

function StaffPedidoDialog({ pedido, onClose }: { pedido: Pedido | null; onClose: () => void }) {
  const [comentario, setComentario] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entregaInputRef = useRef<HTMLInputElement>(null);

  if (!pedido) return null;

  const enviarComentario = () => {
    const t = comentario.trim();
    if (!t) return;
    adicionarComentario(pedido.id, t, "equipe", "Equipe Peticiona", true);
    setComentario("");
    toast({ title: "Comentário interno adicionado." });
  };

  const onUploadEntrega = (files: FileList | null) => {
    if (!files || !files.length) return;
    adicionarEntregaFinal(pedido.id, Array.from(files));
    toast({
      title: "Entrega final enviada",
      description: `${files.length} arquivo(s) anexado(s).`,
    });
    if (entregaInputRef.current) entregaInputRef.current.value = "";
  };

  const onAlterarStatus = (s: PedidoStatus) => {
    atualizarStatus(pedido.id, s);
    toast({ title: `Status atualizado para "${STATUS_LABEL[s]}".` });
  };

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            Pedido Nº {pedido.numero}
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
            Criado em {formatDateTime(pedido.criadoEmISO)} · Entrega interna:{" "}
            {format(parseISO(pedido.prazoEntregaInternoISO), "dd/MM/yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ações da equipe */}
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Status do pedido
                </Label>
                <Select value={pedido.status} onValueChange={(v) => onAlterarStatus(v as PedidoStatus)}>
                  <SelectTrigger className="w-full sm:w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_analise">🔵 Em análise</SelectItem>
                    <SelectItem value="aguardando_dados">🔴 Aguardando dados</SelectItem>
                    <SelectItem value="concluido">🟢 Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Entrega final
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => entregaInputRef.current?.click()}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Enviar arquivo de entrega
                  </Button>
                  <input
                    ref={entregaInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => onUploadEntrega(e.target.files)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {pedido.entregasFinais.length} arquivo(s) já enviados
                  </span>
                </div>
                {pedido.entregasFinais.length > 0 && (
                  <ul className="mt-1 space-y-1.5">
                    {pedido.entregasFinais.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate text-foreground">{a.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(a.tamanho)} · {formatDateTime(a.dataISO)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dados (somente leitura) */}
          <ReadonlySection title="Serviço">
            <ReadonlyField label="Modalidade" value={pedido.modalidadeLabel} />
            <ReadonlyField label="Valor" value={formatBRL(pedido.valor)} />
            <ReadonlyField
              label="Entrega cliente"
              value={formatDateTime(pedido.prazoEntregaClienteISO)}
            />
            <ReadonlyField
              label="Entrega interna"
              value={formatDateTime(pedido.prazoEntregaInternoISO)}
            />
          </ReadonlySection>

          <ReadonlySection title="1. Dados da solicitação">
            <ReadonlyField label="Área do Direito" value={pedido.areaDireito} />
            <ReadonlyField label="Tipo de petição" value={pedido.tipoPeticao || "—"} />
          </ReadonlySection>

          <ReadonlySection title="2. Dados do processo">
            <ReadonlyField
              label="Data da publicação"
              value={
                pedido.dataPublicacao
                  ? format(parseISO(pedido.dataPublicacao), "dd/MM/yyyy", { locale: ptBR })
                  : "—"
              }
            />
            <ReadonlyField label="Número do processo" value={pedido.numeroProcesso || "—"} />
            <ReadonlyField label="Competência" value={pedido.competencia || "—"} />
            <ReadonlyField label="Comarca" value={pedido.comarca || "—"} />
            <ReadonlyField label="Justiça gratuita" value={pedido.justicaGratuita ? "Sim" : "Não"} />
            <ReadonlyField label="Tutela de urgência" value={pedido.tutelaUrgencia ? "Sim" : "Não"} />
          </ReadonlySection>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">3. Partes do processo</h3>
            {pedido.partes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma parte cadastrada.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {pedido.partes.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-foreground">{p.nome || "—"}</span>
                    <span className="text-muted-foreground">{p.tipo || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">4. Informações sobre o caso</h3>
            <ReadonlyTextarea label="Resumo" value={pedido.resumoCaso || "—"} />
            <ReadonlyTextarea label="Tópicos imprescindíveis" value={pedido.detalhes || "—"} />
            <ReadonlyField label="Advogado subscritor" value={pedido.advogadoSubscritor || "—"} />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">5. Anexos do cliente</h3>
            {pedido.anexosOriginais.length === 0 && pedido.anexosCliente.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum anexo enviado.</p>
            ) : (
              <ul className="space-y-1.5">
                {[...pedido.anexosOriginais, ...pedido.anexosCliente].map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate text-foreground">{a.nome}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(a.tamanho)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comentários (cliente + internos) */}
          <section className="space-y-3 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground">Comentários</h3>
            <p className="text-xs text-muted-foreground">
              Inclui comentários do cliente e internos da equipe (não visíveis ao cliente).
            </p>

            {pedido.comentarios.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Nenhum comentário ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...pedido.comentarios]
                  .sort((a, b) => a.dataISO.localeCompare(b.dataISO))
                  .map((c) => (
                    <li
                      key={c.id}
                      className={cn(
                        "rounded-md border p-3 text-sm",
                        c.interno
                          ? "border-accent/40 bg-accent/10"
                          : c.autor === "cliente"
                          ? "border-primary/20 bg-primary/5"
                          : "border-border bg-muted/30",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {c.autorNome}
                          {c.interno && (
                            <span className="ml-2 rounded-sm bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                              Interno
                            </span>
                          )}
                        </span>
                        <span>{formatDateTime(c.dataISO)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-foreground">{c.texto}</p>
                    </li>
                  ))}
              </ul>
            )}

            <div className="space-y-2">
              <Label htmlFor="novo-comentario-interno">Adicionar comentário interno</Label>
              <Textarea
                id="novo-comentario-interno"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Anotação visível somente para a equipe interna..."
                rows={3}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled
                  title="Use 'Enviar arquivo de entrega' acima"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Anexar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={enviarComentario}
                  disabled={!comentario.trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Salvar comentário
                </Button>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReadonlySection({ title, children }: { title: string; children: React.ReactNode }) {
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
