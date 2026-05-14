import { useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  Edit3,
  Save,
  X,
  UserRound,
  Paperclip,
  FileText,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { type ClientOrder, type Petition } from "@/lib/api";

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

interface EditOrderDialogProps {
  order: ClientOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Record<string, unknown>) => void;
  isSubmitting?: boolean;
}

export function EditOrderDialog({
  order,
  open,
  onOpenChange,
  onSave,
  isSubmitting,
}: EditOrderDialogProps) {
  const petition = order?.petition ?? null;

  const initialForm = useMemo(() => {
    if (!petition) {
      return {
        deadline_at: order?.deadline_at ? parseISO(order.deadline_at) : undefined,
        area_direito: "",
        tipo_peticao: "",
        numero_processo: "",
        data_publicacao: undefined as Date | undefined,
        advogado_subscritor: "",
        resumo_caso: "",
        detalhes: "",
        justica_gratuita: "nao" as string,
        tutela_urgencia: "nao" as string,
      };
    }
    return {
      deadline_at: order?.deadline_at ? parseISO(order.deadline_at) : undefined,
      area_direito: petition.area_direito || "",
      tipo_peticao: petition.tipo_peticao || "",
      numero_processo: petition.numero_processo || "",
      data_publicacao: petition.data_publicacao
        ? parseISO(petition.data_publicacao)
        : undefined,
      advogado_subscritor: petition.advogado_subscritor || "",
      resumo_caso: petition.resumo_caso || "",
      detalhes: petition.detalhes || "",
      justica_gratuita: petition.justica_gratuita ? "sim" : "nao",
      tutela_urgencia: petition.tutela_urgencia ? "sim" : "nao",
    };
  }, [petition, order]);

  const [formData, setFormData] = useState(initialForm);

  // Atualiza o form sempre que o pedido (order/petition) muda
  useEffect(() => {
    setFormData(initialForm);
  }, [initialForm]);

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const data: Record<string, unknown> = {};

    if (formData.deadline_at) {
      data.deadline_at = (formData.deadline_at as Date).toISOString();
    }

    if (petition) {
      if (formData.area_direito !== (petition.area_direito || "")) {
        data.area_direito = formData.area_direito;
      }
      if (formData.tipo_peticao !== (petition.tipo_peticao || "")) {
        data.tipo_peticao = formData.tipo_peticao;
      }
      if (formData.numero_processo !== (petition.numero_processo || "")) {
        data.numero_processo = formData.numero_processo;
      }
      if (formData.data_publicacao) {
        const original = petition.data_publicacao ? parseISO(petition.data_publicacao) : undefined;
        if (!original || formData.data_publicacao.getTime() !== original.getTime()) {
          data.data_publicacao = (formData.data_publicacao as Date).toISOString();
        }
      }
      if (formData.advogado_subscritor !== (petition.advogado_subscritor || "")) {
        data.advogado_subscritor = formData.advogado_subscritor;
      }
      if (formData.resumo_caso !== (petition.resumo_caso || "")) {
        data.resumo_caso = formData.resumo_caso;
      }
      if (formData.detalhes !== (petition.detalhes || "")) {
        data.detalhes = formData.detalhes;
      }
      const origJg = petition.justica_gratuita ? "sim" : "nao";
      if (formData.justica_gratuita !== origJg) {
        data.justica_gratuita = formData.justica_gratuita === "sim";
      }
      const origTu = petition.tutela_urgencia ? "sim" : "nao";
      if (formData.tutela_urgencia !== origTu) {
        data.tutela_urgencia = formData.tutela_urgencia === "sim";
      }
    }

    onSave(data);
  };

  const hasPetition = !!petition;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-primary" />
                Editar pedido
              </DialogTitle>
              <DialogDescription>
                {order?.reference} — {order?.service_type}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSubmitting}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-8">
          {/* Prazo de entrega (sempre editável) */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              Informações do pedido
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
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
            </div>
          </section>

          {hasPetition && (
            <>
              {/* Dados da petição */}
              <section className="space-y-4">
                <h3 className="text-base font-semibold text-foreground">
                  Dados da petição
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="area_direito">
                      Área do Direito <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.area_direito}
                      onValueChange={(value) => handleChange("area_direito", value)}
                    >
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

                  <div className="space-y-2">
                    <Label htmlFor="tipo_peticao">Tipo de petição</Label>
                    <Select
                      value={formData.tipo_peticao}
                      onValueChange={(value) => handleChange("tipo_peticao", value)}
                    >
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

                  <div className="space-y-2">
                    <Label htmlFor="numero_processo">Número do processo</Label>
                    <Input
                      id="numero_processo"
                      placeholder="0000000-00.0000.0.00.0000"
                      value={formData.numero_processo}
                      onChange={(e) => handleChange("numero_processo", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
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

                  <div className="space-y-2">
                    <Label htmlFor="advogado_subscritor">Advogado subscritor</Label>
                    <Input
                      id="advogado_subscritor"
                      placeholder="Nome do(a) advogado(a) que assinará a peça"
                      value={formData.advogado_subscritor}
                      onChange={(e) => handleChange("advogado_subscritor", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Justiça gratuita?</Label>
                    <RadioGroup
                      value={formData.justica_gratuita}
                      onValueChange={(value) => handleChange("justica_gratuita", value)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="sim" id="jg-sim" />
                        <Label htmlFor="jg-sim" className="font-normal">Sim</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nao" id="jg-nao" />
                        <Label htmlFor="jg-nao" className="font-normal">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Tutela de urgência?</Label>
                    <RadioGroup
                      value={formData.tutela_urgencia}
                      onValueChange={(value) => handleChange("tutela_urgencia", value)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="sim" id="tu-sim" />
                        <Label htmlFor="tu-sim" className="font-normal">Sim</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nao" id="tu-nao" />
                        <Label htmlFor="tu-nao" className="font-normal">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </section>

              {/* Resumo e detalhes */}
              <section className="space-y-4">
                <h3 className="text-base font-semibold text-foreground">
                  Informações sobre o caso
                </h3>

                <div className="flex gap-3 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm text-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p>
                    Os anexos não podem ser alterados por este formulário. Para enviar novos documentos, utilize a área de upload do pedido.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resumo_caso">Resumo do caso</Label>
                  <Textarea
                    id="resumo_caso"
                    placeholder="Descreva brevemente o objeto do processo"
                    value={formData.resumo_caso}
                    onChange={(e) => handleChange("resumo_caso", e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="detalhes">Detalhes adicionais</Label>
                  <Textarea
                    id="detalhes"
                    placeholder="Liste os tópicos, pedidos e teses que devem constar na petição"
                    value={formData.detalhes}
                    onChange={(e) => handleChange("detalhes", e.target.value)}
                    rows={4}
                  />
                </div>
              </section>

              {/* Partes (read-only) */}
              <section className="space-y-4">
                <h3 className="text-base font-semibold text-foreground">Partes</h3>
                {!petition.partes?.length ? (
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

              {/* Documentos (read-only) */}
              <section className="space-y-4">
                <h3 className="text-base font-semibold text-foreground">Documentos enviados</h3>
                {!petition.documents?.length ? (
                  <p className="text-sm text-muted-foreground">Nenhum documento vinculado.</p>
                ) : (
                  <ul className="grid gap-2">
                    {petition.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.size_label} ·{" "}
                              {doc.created_at
                                ? format(parseISO(doc.created_at), "dd/MM/yyyy HH:mm", {
                                    locale: ptBR,
                                  })
                                : ""}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {!hasPetition && (
            <div className="rounded-md border border-border bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p>Este pedido não possui petição vinculada.</p>
              <p className="mt-1">Somente o prazo de entrega pode ser editado.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
