import { useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CreditCard, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { api, type CreditPaymentConfig } from "@/lib/api";
import { maskPhone } from "@/lib/masks";
import { createPagarmeCardToken } from "@/lib/pagarme";
import { formatBRL } from "@/lib/format";

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PackageId = string;

interface PackageOption {
  id: PackageId;
  kind: "plan" | "single";
  name: string;
  value: number;
  creditValue: number;
  description: string;
  perOrder?: number;
}

interface PaymentFormState {
  document: string;
  phone: string;
  cardNumber: string;
  cardHolder: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  city: string;
  state: string;
}

const emptyForm: PaymentFormState = {
  document: "",
  phone: "",
  cardNumber: "",
  cardHolder: "",
  expMonth: "",
  expYear: "",
  cvv: "",
  zipCode: "",
  street: "",
  number: "",
  neighborhood: "",
  complement: "",
  city: "",
  state: "",
};

export const BuyCreditsDialog = ({ open, onOpenChange }: BuyCreditsDialogProps) => {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me.get(),
  });
  const [config, setConfig] = useState<CreditPaymentConfig | null>(null);
  const [selectedId, setSelectedId] = useState<PackageId | null>(null);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof PaymentFormState, string>>>({});

  const packages = useMemo<PackageOption[]>(
    () => {
      return (config?.packages ?? []).map((pkg) => ({
        id: pkg.id,
        kind: pkg.kind,
        name: pkg.name,
        value: pkg.amount_cents / 100,
        creditValue: pkg.credit_cents / 100,
        description: pkg.description,
      }));
    },
    [config],
  );
  const selected = packages.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    setForm((current) => ({
      ...current,
      document: current.document || profile?.cpf || "",
      phone: current.phone || profile?.phone || "",
      cardHolder: current.cardHolder || profile?.full_name || "",
    }));
    api.payments.creditPackages().then(setConfig).catch(() => {
      toast({
        title: "Pagamento indisponível",
        description: "Não foi possível carregar a configuração da Pagar.me.",
        variant: "destructive",
      });
    });
  }, [open, profile?.cpf, profile?.phone, profile?.full_name]);

  const setField = (field: keyof PaymentFormState, value: string) => {
    const nextValue =
      field === "document"
        ? maskDocument(value)
        : field === "phone"
          ? maskPhone(value)
          : field === "state"
            ? value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase()
            : field === "cardNumber" || field === "cvv" || field === "expMonth" || field === "expYear" || field === "zipCode"
              ? value.replace(/\D/g, "")
              : value;
    setForm((current) => ({ ...current, [field]: nextValue }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;

    const validation = validate(form);
    setErrors(validation.errors);
    if (!validation.ok) {
      toast({
        title: "Verifique os dados",
        description: "Complete os campos obrigatórios para continuar.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const publicKey = config?.public_key ?? "";
      const dryRun = Boolean(config?.dry_run);
      if (!publicKey && !dryRun) {
        throw new Error("Chave pública da Pagar.me não configurada.");
      }

      const cardToken = dryRun && !publicKey
        ? `dryrun_${newId()}`
        : await createPagarmeCardToken(publicKey, {
            number: digits(form.cardNumber),
            holder_name: form.cardHolder.trim(),
            exp_month: Number(form.expMonth),
            exp_year: normalizeYear(form.expYear),
            cvv: digits(form.cvv),
          });

      const response = await api.payments.createCreditOrder({
        package_id: selected.id,
        idempotency_key: newId(),
        card_token: cardToken,
        customer: {
          document: form.document,
          phone: form.phone,
        },
        billing_address: {
          zip_code: form.zipCode,
          street: form.street,
          number: form.number,
          neighborhood: form.neighborhood,
          complement: form.complement || undefined,
          city: form.city,
          state: form.state,
        },
        antifraud: {
          session_id: getPaymentSessionId(),
          device: { platform: navigator.platform || "web" },
        },
      });

      if (response.purchase.paid) {
        queryClient.invalidateQueries({ queryKey: ["me-balance"] });
        toast({
          title: "Crédito adicionado",
          description: `${selected.name} confirmado pela Pagar.me.`,
        });
        closeAndReset();
      } else if (response.purchase.status === "failed") {
        toast({
          title: "Pagamento não aprovado",
          description: "A cobrança não foi confirmada pela Pagar.me.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Pagamento em análise",
          description: "O saldo será liberado após a confirmação da Pagar.me.",
        });
        closeAndReset();
      }
    } catch (error) {
      toast({
        title: "Pagamento não concluído",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const closeAndReset = () => {
    setSelectedId(null);
    setForm({
      ...emptyForm,
      document: profile?.cpf || "",
      phone: profile?.phone || "",
      cardHolder: profile?.full_name || "",
    });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selected ? "Finalizar compra" : "Comprar créditos"}</DialogTitle>
          <DialogDescription>
            Pagamento com cartão via Pagar.me. O saldo é creditado após confirmação.
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <PackageTabs
            packages={packages}
            loading={!config}
            processing={processing}
            onSelect={(id) => setSelectedId(id)}
          />
        ) : (
          <form className="mt-2 space-y-5" onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-secondary/40 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">{selected.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <p className="font-display text-xl font-semibold text-primary">
                {formatBRL(selected.value)}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="CPF/CNPJ"
                value={form.document}
                error={errors.document}
                onChange={(value) => setField("document", value)}
                inputMode="numeric"
                maxLength={18}
              />
              <Field
                label="Telefone"
                value={form.phone}
                error={errors.phone}
                onChange={(value) => setField("phone", value)}
                inputMode="tel"
                maxLength={20}
              />
            </div>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CreditCard className="h-4 w-4 text-primary" />
                Cartão
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Número"
                  value={form.cardNumber}
                  error={errors.cardNumber}
                  onChange={(value) => setField("cardNumber", value)}
                  inputMode="numeric"
                  maxLength={19}
                />
                <Field
                  label="Nome impresso"
                  value={form.cardHolder}
                  error={errors.cardHolder}
                  onChange={(value) => setField("cardHolder", value)}
                  maxLength={64}
                />
                <Field
                  label="Mês"
                  value={form.expMonth}
                  error={errors.expMonth}
                  onChange={(value) => setField("expMonth", value)}
                  inputMode="numeric"
                  maxLength={2}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Ano"
                    value={form.expYear}
                    error={errors.expYear}
                    onChange={(value) => setField("expYear", value)}
                    inputMode="numeric"
                    maxLength={4}
                  />
                  <Field
                    label="CVV"
                    value={form.cvv}
                    error={errors.cvv}
                    onChange={(value) => setField("cvv", value)}
                    inputMode="numeric"
                    maxLength={4}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Endereço de cobrança
              </div>
              <div className="grid gap-4 sm:grid-cols-6">
                <Field
                  className="sm:col-span-2"
                  label="CEP"
                  value={form.zipCode}
                  error={errors.zipCode}
                  onChange={(value) => setField("zipCode", value)}
                  inputMode="numeric"
                  maxLength={8}
                />
                <Field
                  className="sm:col-span-4"
                  label="Rua"
                  value={form.street}
                  error={errors.street}
                  onChange={(value) => setField("street", value)}
                  maxLength={80}
                />
                <Field
                  className="sm:col-span-2"
                  label="Número"
                  value={form.number}
                  error={errors.number}
                  onChange={(value) => setField("number", value)}
                  maxLength={20}
                />
                <Field
                  className="sm:col-span-4"
                  label="Bairro"
                  value={form.neighborhood}
                  error={errors.neighborhood}
                  onChange={(value) => setField("neighborhood", value)}
                  maxLength={80}
                />
                <Field
                  className="sm:col-span-3"
                  label="Cidade"
                  value={form.city}
                  error={errors.city}
                  onChange={(value) => setField("city", value)}
                  maxLength={64}
                />
                <Field
                  className="sm:col-span-1"
                  label="UF"
                  value={form.state}
                  error={errors.state}
                  onChange={(value) => setField("state", value)}
                  maxLength={2}
                />
                <Field
                  className="sm:col-span-2"
                  label="Complemento"
                  value={form.complement}
                  onChange={(value) => setField("complement", value)}
                  maxLength={80}
                />
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedId(null)}
                disabled={processing}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={processing}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {processing ? "Processando..." : "Pagar e adicionar créditos"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

function PackageTabs({
  packages,
  loading,
  processing,
  onSelect,
}: {
  packages: PackageOption[];
  loading: boolean;
  processing: boolean;
  onSelect: (id: PackageId) => void;
}) {
  const planPackages = packages.filter((item) => item.kind === "plan");
  const singlePackages = packages.filter((item) => item.kind === "single");

  return (
    <Tabs defaultValue="planos" className="mt-2">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="planos">
          <Sparkles className="mr-2 h-4 w-4" />
          Planos
        </TabsTrigger>
        <TabsTrigger value="avulsos">
          <Zap className="mr-2 h-4 w-4" />
          Créditos avulsos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="planos" className="mt-4 grid gap-4 md:grid-cols-3">
        {loading && <p className="text-sm text-muted-foreground">Carregando pacotes...</p>}
        {!loading && planPackages.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum plano disponível.</p>
        )}
        {planPackages.map((p) => (
          <div key={p.id} className="flex flex-col rounded-lg border border-border bg-card p-5">
            <h4 className="font-display text-lg font-semibold text-foreground">{p.name}</h4>
            <p className="mt-1 font-display text-2xl font-semibold text-primary">
              {formatBRL(p.value)}
              <span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
            <ul className="mt-3 flex-1 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                Saldo de {formatBRL(p.creditValue)} mensais
              </li>
              {p.perOrder ? (
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {formatBRL(p.perOrder)} por pedido
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {p.description}
                </li>
              )}
            </ul>
            <Button
              type="button"
              className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => onSelect(p.id)}
              disabled={processing}
            >
              Assinar
            </Button>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="avulsos" className="mt-4 grid gap-4 sm:grid-cols-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando pacotes...</p>}
        {!loading && singlePackages.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum crédito avulso disponível.</p>
        )}
        {singlePackages.map((a) => (
          <div key={a.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
            <h4 className="font-medium text-foreground">{a.name}</h4>
            <p className="mt-1 font-display text-xl font-semibold text-primary">
              {formatBRL(a.value)}
            </p>
            <p className="mt-1 flex-1 text-xs text-muted-foreground">{a.description}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => onSelect(a.id)}
              disabled={processing}
            >
              Comprar
            </Button>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function Field({
  label,
  value,
  error,
  onChange,
  className,
  ...inputProps
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        {...inputProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function validate(form: PaymentFormState) {
  const errors: Partial<Record<keyof PaymentFormState, string>> = {};
  if (![11, 14].includes(digits(form.document).length)) errors.document = "Informe CPF ou CNPJ.";
  if (![10, 11].includes(digits(form.phone).length)) errors.phone = "Informe um telefone válido.";
  if (digits(form.cardNumber).length < 13) errors.cardNumber = "Número inválido.";
  if (form.cardHolder.trim().length < 3) errors.cardHolder = "Nome obrigatório.";
  const month = Number(form.expMonth);
  if (!month || month < 1 || month > 12) errors.expMonth = "Mês inválido.";
  if (normalizeYear(form.expYear) < new Date().getFullYear()) errors.expYear = "Ano inválido.";
  if (![3, 4].includes(digits(form.cvv).length)) errors.cvv = "CVV inválido.";
  if (digits(form.zipCode).length !== 8) errors.zipCode = "CEP inválido.";
  if (!form.street.trim()) errors.street = "Rua obrigatória.";
  if (!form.number.trim()) errors.number = "Número obrigatório.";
  if (!form.neighborhood.trim()) errors.neighborhood = "Bairro obrigatório.";
  if (!form.city.trim()) errors.city = "Cidade obrigatória.";
  if (!/^[A-Z]{2}$/.test(form.state)) errors.state = "UF inválida.";
  return { ok: Object.keys(errors).length === 0, errors };
}

function normalizeYear(value: string) {
  const year = Number(digits(value));
  return year < 100 ? 2000 + year : year;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function maskDocument(value: string) {
  const onlyDigits = digits(value).slice(0, 14);
  if (onlyDigits.length <= 11) {
    return onlyDigits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return onlyDigits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function getPaymentSessionId() {
  const key = "peticiona:pagarme-session";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = newId();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return newId();
  }
}
