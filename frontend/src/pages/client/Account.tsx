import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { profileEditableSchema } from "@/lib/profileSchemas";

export default function Account() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me.get(),
  });
  const { data: documentsData, isLoading: loadingDocuments } = useQuery({
    queryKey: ["me", "documents"],
    queryFn: () => api.me.documents(),
  });

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; email?: string }>({});
  const documents = documentsData?.documents ?? [];

  // Sincroniza quando perfil/usuário carregam.
  useEffect(() => {
    if (!user) return;
    setPhone(user.phone ?? "");
    setEmail(user.email ?? "");
  }, [user]);

  const mutation = useMutation({
    mutationFn: (payload: { email: string; phone: string }) => api.me.update(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
      toast({ title: "Dados atualizados com sucesso." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível salvar os dados",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: number) => api.documents.delete(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "documents"] });
      toast({ title: "Documento removido." });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível remover o documento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = profileEditableSchema.safeParse({ phone, email });
    if (!result.success) {
      const fieldErrors: { phone?: string; email?: string } = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as "phone" | "email";
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      toast({
        title: "Verifique os campos",
        description: "Corrija os erros destacados.",
        variant: "destructive",
      });
      return;
    }
    setErrors({});
    mutation.mutate({ phone: result.data.phone, email: result.data.email });
  };

  // Dados imutáveis — fallback para o backend quando o perfil local não tem.
  const fullName = user?.full_name || "";
  const cpf = user?.cpf || "";
  const oab = user?.oab_number || "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Minha conta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você pode alterar telefone e e-mail. Para corrigir nome, CPF ou OAB,
          entre em contato com nossa equipe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            {/* Imutáveis */}
            <ReadonlyField
              label="Nome completo"
              value={fullName || "—"}
              hint="Somente leitura"
              className="sm:col-span-2"
            />
            <ReadonlyField label="CPF" value={cpf || "—"} hint="Somente leitura" />
            <ReadonlyField label="OAB / UF" value={oab || "—"} hint="Somente leitura" />

            {/* Editáveis */}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="email">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                aria-invalid={!!errors.email}
                required
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="phone">
                Telefone / WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                aria-invalid={!!errors.phone}
                required
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {mutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Documentos enviados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingDocuments ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando documentos...</p>
          ) : documents.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhum documento avulso encontrado.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-secondary p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{document.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.size_label} · {formatDocumentDate(document.created_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-destructive hover:text-destructive sm:self-auto"
                    disabled={deleteDocumentMutation.isPending}
                    onClick={() => deleteDocumentMutation.mutate(document.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Segurança</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-2">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Senha</p>
              <p className="text-sm text-muted-foreground">
                Altere sua senha de acesso.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled>
            Em breve
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDocumentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleDateString("pt-BR");
}

function ReadonlyField({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground">{label}</Label>
        {hint && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      <Input value={value} disabled />
    </div>
  );
}
