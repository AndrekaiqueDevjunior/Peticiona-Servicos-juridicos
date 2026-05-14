import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FileText, Filter, Paperclip, Search, UserRound, Edit, Save, X, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { api, type ClientOrder, type Petition } from "@/lib/api";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

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

const statusTone: Record<string, string> = {
  pendente: "bg-accent-soft text-primary",
  em_andamento: "bg-secondary text-foreground",
  concluido: "bg-emerald-100 text-emerald-900",
};

export default function Orders() {
  const queryClient = useQueryClient();
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["client-orders"],
    queryFn: () => api.clientArea.orders(),
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.clientArea.updateOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      toast.success("Pedido atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar pedido");
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id: number) => api.clientArea.cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-orders"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      toast.success("Pedido cancelado. Créditos estornados quando aplicável.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Não foi possível cancelar este pedido.");
    },
  });

  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData?.orders]);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [pedidoSelecionado, setPedidoSelecionado] = useState<ClientOrder | null>(null);
  const [pedidoParaCancelar, setPedidoParaCancelar] = useState<ClientOrder | null>(null);

  // Mantém compatibilidade com o dialog de petições
  const petitionSelecionada = pedidoSelecionado?.petition ?? null;
  const setPetitionSelecionada = (p: Petition | null) => {
    if (!p) setPedidoSelecionado(null);
  };

  const statusOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (!map.has(o.status)) map.set(o.status, o.status_label);
    });
    return [{ value: "todos", label: "Todos os status" }].concat(
      Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    );
  }, [orders]);

  const pedidosFiltrados = useMemo(() => {
    return orders.filter((o) => {
      if (statusFiltro !== "todos" && o.status !== statusFiltro) return false;
      if (!dataInicio && !dataFim) return true;
      try {
        const created = parseISO(o.created_at);
        const start = dataInicio ? startOfDay(dataInicio) : new Date(0);
        const end = dataFim ? endOfDay(dataFim) : new Date(8.64e15);
        return isWithinInterval(created, { start, end });
      } catch { return true; }
    });
  }, [orders, statusFiltro, dataInicio, dataFim]);

  const limparFiltros = () => {
    setStatusFiltro("todos");
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const filtrosAtivos = statusFiltro !== "todos" || !!dataInicio || !!dataFim;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Meus pedidos
        </h1>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="h-9 w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DateFilter
            label="Data inicial"
            value={dataInicio}
            placeholder="De"
            onSelect={setDataInicio}
          />
          <DateFilter
            label="Data final"
            value={dataFim}
            placeholder="Até"
            onSelect={setDataFim}
          />

          {filtrosAtivos && (
            <Button type="button" variant="ghost" size="sm" onClick={limparFiltros} className="h-9">
              Limpar
            </Button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {pedidosFiltrados.length} de {orders.length} pedidos
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-14 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido ainda. Use o botão "Novo pedido" para começar.
            </p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido corresponde aos filtros selecionados.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pedidosFiltrados.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-secondary p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{order.service_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.reference}
                        {order.deadline_at
                          ? ` · Prazo: ${format(parseISO(order.deadline_at), "dd/MM/yyyy", { locale: ptBR })}`
                          : ""}
                        {" · "}
                        {format(parseISO(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        {" · "}
                        {order.total_brl}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
                        statusTone[order.status] ?? "bg-secondary text-foreground",
                      )}
                    >
                      {order.status_label}
                    </span>
                    {order.petition && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPedidoSelecionado(order)}
                        aria-label={`Ver detalhes do pedido ${order.reference}`}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    )}
                    {order.status === "pendente" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPedidoParaCancelar(order)}
                        aria-label={`Cancelar pedido ${order.reference}`}
                        disabled={cancelOrderMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PetitionDetailsDialog
        petition={petitionSelecionada}
        order={pedidoSelecionado}
        onClose={() => setPetitionSelecionada(null)}
        onEdit={(data) => {
          if (pedidoSelecionado) {
            updateOrderMutation.mutate({ id: pedidoSelecionado.id, data });
          }
        }}
        canEdit={pedidoSelecionado?.status === "pendente"}
      />

      <AlertDialog
        open={!!pedidoParaCancelar}
        onOpenChange={(open) => !open && setPedidoParaCancelar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido {pedidoParaCancelar?.reference} será cancelado e os créditos
              utilizados serão estornados automaticamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelOrderMutation.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pedidoParaCancelar) {
                  cancelOrderMutation.mutate(pedidoParaCancelar.id);
                  setPedidoParaCancelar(null);
                }
              }}
              disabled={cancelOrderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelOrderMutation.isPending ? "Cancelando..." : "Cancelar pedido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DateFilter({
  label,
  value,
  placeholder,
  onSelect,
}: {
  label: string;
  value: Date | undefined;
  placeholder: string;
  onSelect: (date: Date | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 w-[170px] justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onSelect}
            initialFocus
            className={cn("pointer-events-auto p-3")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PetitionDetailsDialog({
  petition,
  order,
  onClose,
  onEdit,
  canEdit,
}: {
  petition: Petition | null;
  order: ClientOrder | null;
  onClose: () => void;
  onEdit: (data: any) => void;
  canEdit: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (!petition) return {};
    
    return {
      deadline_at: order?.deadline_at ? parseISO(order.deadline_at) : undefined,
      area_direito: petition.area_direito || "",
      tipo_peticao: petition.tipo_peticao || "",
      numero_processo: petition.numero_processo || "",
      data_publicacao: petition.data_publicacao ? parseISO(petition.data_publicacao) : undefined,
      advogado_subscritor: petition.advogado_subscritor || "",
      resumo_caso: petition.resumo_caso || "",
      detalhes: petition.detalhes || "",
      justica_gratuita: petition.justica_gratuita ? "sim" : "nao",
      tutela_urgencia: petition.tutela_urgencia ? "sim" : "nao",
    };
  });

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data
    setFormData({
      deadline_at: order?.deadline_at ? parseISO(order.deadline_at) : undefined,
      area_direito: petition?.area_direito || "",
      tipo_peticao: petition?.tipo_peticao || "",
      numero_processo: petition?.numero_processo || "",
      data_publicacao: petition?.data_publicacao ? parseISO(petition.data_publicacao) : undefined,
      advogado_subscritor: petition?.advogado_subscritor || "",
      resumo_caso: petition?.resumo_caso || "",
      detalhes: petition?.detalhes || "",
      justica_gratuita: petition?.justica_gratuita ? "sim" : "nao",
      tutela_urgencia: petition?.tutela_urgencia ? "sim" : "nao",
    });
  };

  const handleSave = () => {
    // Valores originais para comparação
    const originalData = {
      deadline_at: order?.deadline_at ? parseISO(order.deadline_at) : undefined,
      area_direito: petition?.area_direito || "",
      tipo_peticao: petition?.tipo_peticao || "",
      numero_processo: petition?.numero_processo || "",
      data_publicacao: petition?.data_publicacao ? parseISO(petition.data_publicacao) : undefined,
      advogado_subscritor: petition?.advogado_subscritor || "",
      resumo_caso: petition?.resumo_caso || "",
      detalhes: petition?.detalhes || "",
      justica_gratuita: petition?.justica_gratuita ? "sim" : "nao",
      tutela_urgencia: petition?.tutela_urgencia ? "sim" : "nao",
    };

    const data: any = {};
    
    // Adiciona apenas campos que foram alterados
    Object.keys(formData).forEach(key => {
      if (formData[key] !== originalData[key]) {
        if (key === "deadline_at" && formData[key]) {
          data[key] = (formData[key] as Date).toISOString();
        } else if (key === "data_publicacao" && formData[key]) {
          data[key] = (formData[key] as Date).toISOString();
        } else if (key === "justica_gratuita") {
          data[key] = formData[key] === "sim";
        } else if (key === "tutela_urgencia") {
          data[key] = formData[key] === "sim";
        } else {
          data[key] = formData[key];
        }
      }
    });
    
    // Se não houver alterações, não envia nada
    if (Object.keys(data).length === 0) {
      setIsEditing(false);
      return;
    }
    
    onEdit(data);
    setIsEditing(false);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={!!petition} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {!petition ? null : (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>{petition.reference}</DialogTitle>
                  <DialogDescription>
                    {petition.tipo_peticao || "Petição"} · {petition.status_label}
                  </DialogDescription>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                          <X className="mr-2 h-4 w-4" />
                          Cancelar
                        </Button>
                        <Button type="button" size="sm" onClick={handleSave}>
                          <Save className="mr-2 h-4 w-4" />
                          Salvar
                        </Button>
                      </>
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={handleEdit}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </DialogHeader>

            <div className="grid gap-6">
              <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
                {isEditing ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="area_direito">Área do Direito *</Label>
                      <Select value={formData.area_direito} onValueChange={(value) => handleChange("area_direito", value)}>
                        <SelectTrigger id="area_direito">
                          <SelectValue placeholder="Selecione uma área" />
                        </SelectTrigger>
                        <SelectContent>
                          {AREAS_DIREITO.map((area) => (
                            <SelectItem key={area} value={area}>
                              {area}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="tipo_peticao">Tipo de petição</Label>
                      <Select value={formData.tipo_peticao} onValueChange={(value) => handleChange("tipo_peticao", value)}>
                        <SelectTrigger id="tipo_peticao">
                          <SelectValue placeholder="Selecione um tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPOS_PETICAO).map(([grupo, tipos]) => (
                            <div key={grupo}>
                              <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                                {grupo}
                              </p>
                              {tipos.map((tipo) => (
                                <SelectItem key={tipo} value={tipo}>
                                  {tipo}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="numero_processo">Número do processo</Label>
                      <Input
                        id="numero_processo"
                        value={formData.numero_processo}
                        onChange={(e) => handleChange("numero_processo", e.target.value)}
                        placeholder="0000000-00.0000.0.00.0000"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Data da publicação</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.data_publicacao && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.data_publicacao
                              ? format(formData.data_publicacao, "PPP", { locale: ptBR })
                              : "Escolha uma data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.data_publicacao}
                            onSelect={(date) => handleChange("data_publicacao", date)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid gap-2">
                      <Label>Prazo de entrega</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.deadline_at && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.deadline_at
                              ? format(formData.deadline_at, "PPP", { locale: ptBR })
                              : "Escolha uma data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.deadline_at}
                            onSelect={(date) => handleChange("deadline_at", date)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="advogado_subscritor">Advogado subscritor</Label>
                      <Input
                        id="advogado_subscritor"
                        value={formData.advogado_subscritor}
                        onChange={(e) => handleChange("advogado_subscritor", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Será necessário requerer justiça gratuita?</Label>
                      <RadioGroup
                        value={formData.justica_gratuita}
                        onValueChange={(value) => handleChange("justica_gratuita", value)}
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
                    <div className="space-y-2">
                      <Label>Será necessário requerer tutela de urgência?</Label>
                      <RadioGroup
                        value={formData.tutela_urgencia}
                        onValueChange={(value) => handleChange("tutela_urgencia", value)}
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
                  </>
                ) : (
                  <>
                    <Info label="Área do Direito" value={petition.area_direito} />
                    <Info label="Tipo de petição" value={petition.tipo_peticao || "—"} />
                    <Info label="Número do processo" value={petition.numero_processo || "—"} />
                    <Info
                      label="Data de publicação"
                      value={
                        petition.data_publicacao
                          ? format(parseISO(petition.data_publicacao), "dd/MM/yyyy", { locale: ptBR })
                          : "—"
                      }
                    />
                    {order?.deadline_at && (
                      <Info
                        label="Prazo de entrega"
                        value={format(parseISO(order.deadline_at), "dd/MM/yyyy", { locale: ptBR })}
                      />
                    )}
                    <Info
                      label="Justiça gratuita"
                      value={petition.justica_gratuita ? "Sim" : "Não"}
                    />
                    <Info
                      label="Tutela de urgência"
                      value={petition.tutela_urgencia ? "Sim" : "Não"}
                    />
                    <Info
                      label="Advogado subscritor"
                      value={petition.advogado_subscritor || "—"}
                      className="sm:col-span-2"
                    />
                  </>
                )}
              </section>

              <section className="grid gap-3 rounded-lg border border-border p-4">
                <h3 className="font-medium text-foreground">Resumo do caso</h3>
                {isEditing ? (
                  <Textarea
                    value={formData.resumo_caso}
                    onChange={(e) => handleChange("resumo_caso", e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {petition.resumo_caso || "Sem resumo informado."}
                  </p>
                )}
              </section>

              <section className="grid gap-3 rounded-lg border border-border p-4">
                <h3 className="font-medium text-foreground">Detalhes adicionais</h3>
                {isEditing ? (
                  <Textarea
                    value={formData.detalhes}
                    onChange={(e) => handleChange("detalhes", e.target.value)}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {petition.detalhes || "Sem detalhes adicionais."}
                  </p>
                )}
              </section>

              <section className="grid gap-3 rounded-lg border border-border p-4">
                <h3 className="font-medium text-foreground">Partes</h3>
                {!petition.partes.length ? (
                  <p className="text-sm text-muted-foreground">Nenhuma parte cadastrada.</p>
                ) : (
                  <ul className="grid gap-2">
                    {petition.partes.map((parte, index) => (
                      <li
                        key={`${parte.nome}-${index}`}
                        className="flex items-center gap-3 rounded-md bg-secondary/50 px-3 py-2"
                      >
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

              <section className="grid gap-3 rounded-lg border border-border p-4">
                <h3 className="font-medium text-foreground">Documentos enviados</h3>
                {!petition.documents.length ? (
                  <p className="text-sm text-muted-foreground">Nenhum documento vinculado.</p>
                ) : (
                  <ul className="grid gap-2">
                    {petition.documents.map((document) => (
                      <li
                        key={document.id}
                        className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {document.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {document.size_label} ·{" "}
                              {format(parseISO(document.created_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}


function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
