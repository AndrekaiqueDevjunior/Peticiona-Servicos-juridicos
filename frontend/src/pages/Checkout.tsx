import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";

import { useAuth } from "@/lib/auth";
import { useClientProfile } from "@/lib/clientProfile";
import { api } from "@/lib/api";
import {
  CheckoutApiError,
  STATUS_LABEL,
  STATUS_TONE,
  checkoutApi,
  fetchCheckoutConfig,
  formatAmountFromCents,
  isTerminalStatus,
  tokenizeCard,
  type CheckoutOrder,
  type CheckoutPaymentMethod,
  type CheckoutServiceId,
  type PaymentNextAction,
} from "@/lib/checkoutApi";

// ---------------------------------------------------------------------------
// Helpers de validação
// ---------------------------------------------------------------------------

const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleanCPF.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleanCPF.charAt(10), 10)) return false;

  return true;
};

const validatePhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, "");
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
};

// ---------------------------------------------------------------------------
// Validação dos dados do comprador (apenas para exibição/confirmação;
// o backend é a fonte da verdade do usuário autenticado).
// ---------------------------------------------------------------------------

const buyerSchema = z.object({
  fullName: z.string().trim().min(3, "Nome obrigatório").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  cpf: z
    .string()
    .trim()
    .min(11, "CPF inválido")
    .max(14, "CPF inválido")
    .refine(validateCPF, "CPF inválido"),
  phone: z
    .string()
    .trim()
    .min(10, "Telefone obrigatório")
    .max(20, "Telefone inválido")
    .refine(validatePhone, "Telefone inválido (ex: (11) 91234-5678)"),
});

type BuyerForm = z.infer<typeof buyerSchema>;

const billingAddressSchema = z.object({
  zip_code: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
  street: z.string().trim().min(2, "Rua obrigatória").max(120),
  street_number: z.string().trim().min(1, "Número obrigatório").max(20),
  complement: z.string().trim().max(120).optional(),
  neighborhood: z.string().trim().min(2, "Bairro obrigatório").max(80),
  city: z.string().trim().min(2, "Cidade obrigatória").max(80),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, "UF inválida"),
});

type BillingAddressForm = z.input<typeof billingAddressSchema>;

const cardSchema = z.object({
  number: z.string().trim().regex(/^\d{13,19}$/, "Número do cartão inválido"),
  holder_name: z.string().trim().min(3, "Nome do titular obrigatório").max(120),
  exp_month: z.string().trim().regex(/^(0?[1-9]|1[0-2])$/, "Mês inválido"),
  exp_year: z.string().trim().regex(/^(?:\d{2}|\d{4})$/, "Ano inválido"),
  cvv: z.string().trim().regex(/^\d{3,4}$/, "CVV inválido"),
  installments: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "Parcelas inválidas")
    .refine((v) => {
      const n = parseInt(v, 10);
      return n >= 1 && n <= 12;
    }, "Parcelas devem ser entre 1 e 12"),
});

type CardForm = z.input<typeof cardSchema>;

// ---------------------------------------------------------------------------

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  danger: "bg-destructive/15 text-destructive",
};

const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos

export default function Checkout() {
  const navigate = useNavigate();
  const { orderId: orderIdParam } = useParams<{ orderId?: string }>();
  const [search] = useSearchParams();
  const serviceFromQuery = search.get("service");

  const { user } = useAuth();
  const profile = useClientProfile();

  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const submittingRef = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("credit_card");
  const [nextAction, setNextAction] = useState<PaymentNextAction | null>(null);
  const [pollingStopped, setPollingStopped] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Buscar dados do serviço/plano da API pública para exibir no resumo
  // antes de criar a ordem (evita discrepância entre modal e checkout).
  const { data: plansData } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => api.content.plans(),
    enabled: !!serviceFromQuery && !orderIdParam,
  });
  const { data: catalogData } = useQuery({
    queryKey: ["public-catalog"],
    queryFn: () => api.content.catalog(),
    enabled: !!serviceFromQuery && !orderIdParam,
  });

  const servicePreview = useMemo(() => {
    if (!serviceFromQuery) return null;
    const plan = plansData?.plans.find((p) => p.code === serviceFromQuery);
    if (plan) {
      return {
        id: serviceFromQuery,
        name: plan.name,
        amount: plan.monthly_price_cents,
        type: "plan" as const,
      };
    }
    const service = catalogData?.catalog
      .flatMap((s) => s.items)
      .find((i) => i.code === serviceFromQuery);
    if (service) {
      return {
        id: serviceFromQuery,
        name: service.title,
        amount: service.unit_price,
        type: "service" as const,
      };
    }
    return null;
  }, [serviceFromQuery, plansData, catalogData]);

  const [buyer, setBuyer] = useState<BuyerForm>({
    fullName: profile.fullName || user?.full_name || "",
    email: profile.email || user?.email || "",
    cpf: profile.cpf || "",
    phone: profile.phone || "",
  });
  const [buyerErrors, setBuyerErrors] = useState<Partial<Record<keyof BuyerForm, string>>>({});
  const [billingAddress, setBillingAddress] = useState<BillingAddressForm>({
    zip_code: "",
    street: "",
    street_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });
  const [billingErrors, setBillingErrors] = useState<
    Partial<Record<keyof BillingAddressForm, string>>
  >({});
  const [pagarmePublicKey, setPagarmePublicKey] = useState<string>("");
  const [card, setCard] = useState<CardForm>({
    number: "",
    holder_name: "",
    exp_month: "",
    exp_year: "",
    cvv: "",
    installments: "1",
  });
  const [cardErrors, setCardErrors] = useState<Partial<Record<keyof CardForm, string>>>({});

  // Busca chave pública do Pagar.me uma vez ao montar.
  useEffect(() => {
    fetchCheckoutConfig()
      .then(({ public_key }) => setPagarmePublicKey(public_key))
      .catch(() => {});
  }, []);

  // Sincroniza com perfil quando ele carregar.
  useEffect(() => {
    setBuyer((prev) => ({
      fullName: prev.fullName || profile.fullName || user?.full_name || "",
      email: prev.email || profile.email || user?.email || "",
      cpf: prev.cpf || profile.cpf || "",
      phone: prev.phone || profile.phone || "",
    }));
  }, [profile, user]);

  // ---------- Carregar/criar pedido ----------------------------------------

  const loadOrder = async (id: string) => {
    setLoadingOrder(true);
    setErrorMsg(null);
    try {
      const { order } = await checkoutApi.getStatus(id);
      setOrder(order);
    } catch (e) {
      const msg = e instanceof CheckoutApiError ? e.message : "Pedido não encontrado.";
      setErrorMsg(msg);
    } finally {
      setLoadingOrder(false);
    }
  };

  const createOrder = async (serviceId: CheckoutServiceId, expectedAmount?: number) => {
    setCreatingOrder(true);
    setErrorMsg(null);
    try {
      const { order } = await checkoutApi.createOrder(serviceId, expectedAmount);
      setOrder(order);
      // Atualiza a URL para conter o orderId, para o usuário poder voltar.
      navigate(`/checkout/${order.id}`, { replace: true });
    } catch (e) {
      const msg =
        e instanceof CheckoutApiError ? e.message : "Não foi possível iniciar o checkout.";
      setErrorMsg(msg);
    } finally {
      setCreatingOrder(false);
    }
  };

  // Boot: se tem orderId na URL → carrega; senão cria pedido a partir do query param `service`.
  useEffect(() => {
    if (orderIdParam) {
      void loadOrder(orderIdParam);
      return;
    }
    if (serviceFromQuery) {
      void createOrder(serviceFromQuery, servicePreview?.amount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdParam, serviceFromQuery]);

  // Restaurar nextAction a partir de active_payment ao carregar pedido
  useEffect(() => {
    if (order?.active_payment && !nextAction) {
      const ap = order.active_payment;
      if (ap.type === "pix") {
        setNextAction({
          type: "pix",
          qr_code: ap.qr_code,
          qr_code_url: ap.qr_code_url,
          expires_at: ap.expires_at,
        });
      } else if (ap.type === "boleto") {
        setNextAction({
          type: "boleto",
          boleto_url: ap.boleto_url,
          expires_at: ap.expires_at,
        });
      }
    }
  }, [order, nextAction]);

  // ---------- Polling de status -------------------------------------------

  const pollRef = useRef<number | null>(null);
  const pollStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!order) return;
    if (isTerminalStatus(order.status)) return;
    if (pollingStopped) return;
    // Só faz polling depois que a cobrança foi criada.
    if (order.status !== "processing" && order.status !== "pending" && order.status !== "waiting_payment") return;
    if (!order.pagarme_order_id) return; // ainda não criou cobrança

    if (pollStartRef.current === null) {
      pollStartRef.current = Date.now();
    }

    pollRef.current = window.setInterval(async () => {
      // Timeout: se ficou muito tempo, para o polling e mostra mensagem de espera.
      if (pollStartRef.current !== null && Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setPollingStopped(true);
        setErrorMsg("Ainda estamos aguardando confirmação do pagamento. Você pode atualizar o status manualmente.");
        return;
      }
      try {
        const { order: fresh } = await checkoutApi.getStatus(order.id);
        setOrder(fresh);
        if (isTerminalStatus(fresh.status) && pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
          pollStartRef.current = null;
          if (fresh.status === "paid") {
            toast({
              title: "Pagamento confirmado",
              description: "Seu crédito já está disponível.",
            });
          } else if (fresh.status === "failed" || fresh.status === "refused") {
            setErrorMsg("Pagamento recusado pela operadora. Tente novamente ou use outro método.");
            toast({
              title: "Pagamento recusado",
              description: "Tente novamente ou use outro método.",
              variant: "destructive",
            });
          }
        }
      } catch {
        /* mantém tentando */
      }
    }, 4000);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [order, pollingStopped]);

  // ---------- Submit -------------------------------------------------------

  const handlePay = async () => {
    if (!order || creatingPayment || submittingRef.current) return;
    submittingRef.current = true;
    const parsed = buyerSchema.safeParse(buyer);
    if (!parsed.success) {
      const errs: Partial<Record<keyof BuyerForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof BuyerForm;
        errs[k] = issue.message;
      }
      setBuyerErrors(errs);
      submittingRef.current = false;
      return;
    }
    setBuyerErrors({});
    let parsedBillingAddress: z.output<typeof billingAddressSchema> | null = null;
    let cardToken: string | null = null;
    let cardInstallments = 1;
    if (paymentMethod === "credit_card") {
      const billingResult = billingAddressSchema.safeParse(billingAddress);
      if (!billingResult.success) {
        const nextBillingErrors: Partial<Record<keyof BillingAddressForm, string>> = {};
        for (const issue of billingResult.error.issues) {
          const k = issue.path[0] as keyof BillingAddressForm;
          nextBillingErrors[k] = issue.message;
        }
        setBillingErrors(nextBillingErrors);
        submittingRef.current = false;
        return;
      }
      setBillingErrors({});
      parsedBillingAddress = billingResult.data;

      const cardResult = cardSchema.safeParse({
        ...card,
        number: card.number.replace(/\D/g, ""),
        cvv: card.cvv.replace(/\D/g, ""),
      });
      if (!cardResult.success) {
        const nextCardErrors: Partial<Record<keyof CardForm, string>> = {};
        for (const issue of cardResult.error.issues) {
          const k = issue.path[0] as keyof CardForm;
          nextCardErrors[k] = issue.message;
        }
        setCardErrors(nextCardErrors);
        submittingRef.current = false;
        return;
      }
      setCardErrors({});
      if (!pagarmePublicKey) {
        setErrorMsg("Configuração do gateway não carregada. Recarregue a página.");
        submittingRef.current = false;
        return;
      }
      setCreatingPayment(true);
      setErrorMsg(null);
      setNextAction(null);
      try {
        cardToken = await tokenizeCard(pagarmePublicKey, {
          number: cardResult.data.number,
          holder_name: cardResult.data.holder_name,
          exp_month: Number(cardResult.data.exp_month),
          exp_year: Number(cardResult.data.exp_year),
          cvv: cardResult.data.cvv,
        });
        cardInstallments = Number(cardResult.data.installments);
        // Limpar dados do cartão após tokenização - segurança
        setCard({ number: "", holder_name: "", exp_month: "", exp_year: "", cvv: "", installments: "1" });
      } catch (e) {
        const msg = e instanceof CheckoutApiError ? e.message : "Erro ao processar dados do cartão.";
        setErrorMsg(msg);
        setCreatingPayment(false);
        submittingRef.current = false;
        return;
      }
    } else {
      setCreatingPayment(true);
      setErrorMsg(null);
      setNextAction(null);
    }
    try {
      const res = await checkoutApi.createPayment({
        order_id: order.id,
        payment_method: paymentMethod,
        buyer: {
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          cpf: parsed.data.cpf,
          phone: parsed.data.phone,
        },
        ...(parsedBillingAddress
          ? {
              billing_address: {
                zip_code: parsedBillingAddress.zip_code.replace(/\D/g, ""),
                street: parsedBillingAddress.street,
                street_number: parsedBillingAddress.street_number,
                complement: parsedBillingAddress.complement,
                neighborhood: parsedBillingAddress.neighborhood,
                city: parsedBillingAddress.city,
                state: parsedBillingAddress.state.toUpperCase(),
                country: "BR",
              },
            }
          : {}),
        ...(cardToken
          ? { card: { token: cardToken, installments: cardInstallments } }
          : {}),
      });
      setOrder(res.order);
      setNextAction(res.next_action ?? null);
      if (res.order.status === "failed") {
        setErrorMsg(
          res.failure_reason ||
            "Pagamento recusado pela operadora. Verifique os dados do cartão ou tente outro método."
        );
      }
    } catch (e) {
      const msg =
        e instanceof CheckoutApiError ? e.message : "Não foi possível criar a cobrança.";
      setErrorMsg(msg);
    } finally {
      setCreatingPayment(false);
      submittingRef.current = false;
    }
  };

  const handleRefreshStatus = useCallback(async () => {
    if (!order) return;
    try {
      const { order: fresh } = await checkoutApi.refreshStatus(order.id);
      setOrder(fresh);
      setPollingStopped(false);
      setErrorMsg(null);
      if (fresh.status === "paid") {
        toast({
          title: "Pagamento confirmado",
          description: "Seu crédito já está disponível.",
        });
      } else if (fresh.status === "failed" || fresh.status === "refused") {
        setErrorMsg("Pagamento recusado pela operadora. Tente novamente ou use outro método.");
      }
    } catch (e) {
      const msg = e instanceof CheckoutApiError ? e.message : "Erro ao atualizar status.";
      setErrorMsg(msg);
    }
  }, [order]);

  // ---------- Render -------------------------------------------------------

  // Permite pagar se: pending, failed, ou processing sem cobrança criada
  const canPay =
    !!order &&
    !creatingPayment &&
    (order.status === "pending" ||
      order.status === "failed" ||
      (order.status === "processing" && !order.pagarme_order_id));

  // PIX/Boleto criado mas usuário não pagou e quer tentar outro método
  const isStuckProcessing =
    !!order &&
    order.status === "processing" &&
    !!order.pagarme_order_id &&
    !nextAction;

  const handleRetry = async () => {
    await handlePay();
  };

  return (
    <div className="min-h-screen bg-muted/20 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            Checkout
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pagamento processado com segurança via Pagar.me.
          </p>
        </div>

        {(loadingOrder || creatingOrder) && !order && (
          <Card>
            <CardContent className="flex items-center gap-3 py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {creatingOrder ? "Iniciando seu pedido..." : "Carregando pedido..."}
              </span>
            </CardContent>
          </Card>
        )}

        {!loadingOrder && !creatingOrder && !order && errorMsg && (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <XCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="text-sm">{errorMsg}</p>
              <Button onClick={() => navigate("/area-cliente/saldos")}>
                Voltar aos saldos
              </Button>
            </CardContent>
          </Card>
        )}

        {!loadingOrder && !creatingOrder && !order && !errorMsg && !serviceFromQuery && !orderIdParam && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum serviço selecionado. Volte para a tela de saldos e escolha um plano ou crédito.
            </CardContent>
          </Card>
        )}

        {/* Pré-visualização do serviço antes de criar a ordem */}
        {!loadingOrder && !creatingOrder && !order && !errorMsg && servicePreview && (
          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Serviço selecionado</p>
                <p className="text-lg font-semibold text-foreground">{servicePreview.name}</p>
                <p className="text-xs text-muted-foreground">Código: {servicePreview.id}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="font-display text-2xl font-semibold text-primary">
                  {formatAmountFromCents(servicePreview.amount)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {order && order.status === "paid" && (
          <ConfirmationScreen order={order} onGoToBalance={() => navigate("/area-cliente/saldos")} />
        )}

        {order && (order.status === "canceled" || order.status === "refunded" || order.status === "refused" || order.status === "expired" || order.status === "chargeback") && (
          <TerminalInfoScreen order={order} onBack={() => navigate("/area-cliente/saldos")} />
        )}

        {order && order.status !== "paid" && order.status !== "canceled" && order.status !== "refunded" && order.status !== "refused" && order.status !== "expired" && order.status !== "chargeback" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Coluna esquerda — formulário e método de pagamento */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dados do comprador</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="buyer-name">Nome completo</Label>
                    <Input
                      id="buyer-name"
                      value={buyer.fullName}
                      maxLength={120}
                      onChange={(e) => setBuyer((p) => ({ ...p, fullName: e.target.value }))}
                    />
                    {buyerErrors.fullName && (
                      <p className="text-xs text-destructive">{buyerErrors.fullName}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="buyer-email">E-mail</Label>
                    <Input
                      id="buyer-email"
                      type="email"
                      value={buyer.email}
                      maxLength={255}
                      onChange={(e) => setBuyer((p) => ({ ...p, email: e.target.value }))}
                    />
                    {buyerErrors.email && (
                      <p className="text-xs text-destructive">{buyerErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="buyer-cpf">CPF</Label>
                    <Input
                      id="buyer-cpf"
                      value={buyer.cpf}
                      maxLength={14}
                      placeholder="000.000.000-00"
                      onChange={(e) => setBuyer((p) => ({ ...p, cpf: e.target.value }))}
                    />
                    {buyerErrors.cpf && (
                      <p className="text-xs text-destructive">{buyerErrors.cpf}</p>
                    )}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="buyer-phone">Telefone</Label>
                    <Input
                      id="buyer-phone"
                      value={buyer.phone}
                      maxLength={20}
                      placeholder="(11) 91234-5678"
                      onChange={(e) => setBuyer((p) => ({ ...p, phone: e.target.value }))}
                    />
                    {buyerErrors.phone && (
                      <p className="text-xs text-destructive">{buyerErrors.phone}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Forma de pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as CheckoutPaymentMethod)}
                    className="grid gap-3 sm:grid-cols-3"
                  >
                    <PaymentOption value="pix" label="PIX" icon={<QrCode className="h-4 w-4" />} />
                    <PaymentOption
                      value="credit_card"
                      label="Cartão de crédito"
                      icon={<CreditCard className="h-4 w-4" />}
                    />
                    <PaymentOption value="boleto" label="Boleto" icon={<ShieldCheck className="h-4 w-4" />} />
                  </RadioGroup>

                  {paymentMethod === "credit_card" && (
                    <div className="mt-4 space-y-4 rounded-md border border-border bg-muted/20 p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="card-number">Número do cartão</Label>
                          <Input
                            id="card-number"
                            inputMode="numeric"
                            autoComplete="cc-number"
                            value={card.number}
                            maxLength={19}
                            onChange={(e) => setCard((p) => ({ ...p, number: e.target.value.replace(/\D/g, "") }))}
                          />
                          {cardErrors.number && <p className="text-xs text-destructive">{cardErrors.number}</p>}
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="card-holder">Nome impresso no cartão</Label>
                          <Input
                            id="card-holder"
                            autoComplete="cc-name"
                            value={card.holder_name}
                            maxLength={120}
                            onChange={(e) => setCard((p) => ({ ...p, holder_name: e.target.value }))}
                          />
                          {cardErrors.holder_name && <p className="text-xs text-destructive">{cardErrors.holder_name}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="card-month">Mês</Label>
                          <Input
                            id="card-month"
                            inputMode="numeric"
                            autoComplete="cc-exp-month"
                            placeholder="MM"
                            value={card.exp_month}
                            maxLength={2}
                            onChange={(e) => setCard((p) => ({ ...p, exp_month: e.target.value.replace(/\D/g, "") }))}
                          />
                          {cardErrors.exp_month && <p className="text-xs text-destructive">{cardErrors.exp_month}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="card-year">Ano</Label>
                          <Input
                            id="card-year"
                            inputMode="numeric"
                            autoComplete="cc-exp-year"
                            placeholder="AAAA"
                            value={card.exp_year}
                            maxLength={4}
                            onChange={(e) => setCard((p) => ({ ...p, exp_year: e.target.value.replace(/\D/g, "") }))}
                          />
                          {cardErrors.exp_year && <p className="text-xs text-destructive">{cardErrors.exp_year}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="card-cvv">CVV</Label>
                          <Input
                            id="card-cvv"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            value={card.cvv}
                            maxLength={4}
                            onChange={(e) => setCard((p) => ({ ...p, cvv: e.target.value.replace(/\D/g, "") }))}
                          />
                          {cardErrors.cvv && <p className="text-xs text-destructive">{cardErrors.cvv}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="card-installments">Parcelas</Label>
                          <Input
                            id="card-installments"
                            inputMode="numeric"
                            value={card.installments}
                            maxLength={2}
                            onChange={(e) => setCard((p) => ({ ...p, installments: e.target.value.replace(/\D/g, "") }))}
                          />
                          {cardErrors.installments && <p className="text-xs text-destructive">{cardErrors.installments}</p>}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <MapPin className="h-4 w-4 text-primary" />
                            Endereço de pagamento
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Informe o endereço associado ao pagamento para validação do cartão.
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="billing-zip">CEP</Label>
                            <Input
                              id="billing-zip"
                              inputMode="numeric"
                              autoComplete="postal-code"
                              value={billingAddress.zip_code}
                              maxLength={9}
                              placeholder="00000-000"
                              onChange={(e) =>
                                setBillingAddress((p) => ({
                                  ...p,
                                  zip_code: e.target.value.replace(/[^\d-]/g, ""),
                                }))
                              }
                            />
                            {billingErrors.zip_code && (
                              <p className="text-xs text-destructive">{billingErrors.zip_code}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="billing-state">UF</Label>
                            <Input
                              id="billing-state"
                              autoComplete="address-level1"
                              value={billingAddress.state}
                              maxLength={2}
                              placeholder="SP"
                              onChange={(e) =>
                                setBillingAddress((p) => ({
                                  ...p,
                                  state: e.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
                                }))
                              }
                            />
                            {billingErrors.state && (
                              <p className="text-xs text-destructive">{billingErrors.state}</p>
                            )}
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="billing-street">Rua / Avenida</Label>
                            <Input
                              id="billing-street"
                              autoComplete="address-line1"
                              value={billingAddress.street}
                              maxLength={120}
                              onChange={(e) =>
                                setBillingAddress((p) => ({ ...p, street: e.target.value }))
                              }
                            />
                            {billingErrors.street && (
                              <p className="text-xs text-destructive">{billingErrors.street}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="billing-number">Número</Label>
                            <Input
                              id="billing-number"
                              autoComplete="address-line2"
                              value={billingAddress.street_number}
                              maxLength={20}
                              onChange={(e) =>
                                setBillingAddress((p) => ({
                                  ...p,
                                  street_number: e.target.value,
                                }))
                              }
                            />
                            {billingErrors.street_number && (
                              <p className="text-xs text-destructive">
                                {billingErrors.street_number}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="billing-complement">Complemento</Label>
                            <Input
                              id="billing-complement"
                              autoComplete="address-line3"
                              value={billingAddress.complement ?? ""}
                              maxLength={120}
                              placeholder="Opcional"
                              onChange={(e) =>
                                setBillingAddress((p) => ({
                                  ...p,
                                  complement: e.target.value,
                                }))
                              }
                            />
                            {billingErrors.complement && (
                              <p className="text-xs text-destructive">
                                {billingErrors.complement}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="billing-neighborhood">Bairro</Label>
                            <Input
                              id="billing-neighborhood"
                              autoComplete="address-level3"
                              value={billingAddress.neighborhood}
                              maxLength={80}
                              onChange={(e) =>
                                setBillingAddress((p) => ({
                                  ...p,
                                  neighborhood: e.target.value,
                                }))
                              }
                            />
                            {billingErrors.neighborhood && (
                              <p className="text-xs text-destructive">
                                {billingErrors.neighborhood}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="billing-city">Cidade</Label>
                            <Input
                              id="billing-city"
                              autoComplete="address-level2"
                              value={billingAddress.city}
                              maxLength={80}
                              onChange={(e) =>
                                setBillingAddress((p) => ({ ...p, city: e.target.value }))
                              }
                            />
                            {billingErrors.city && (
                              <p className="text-xs text-destructive">{billingErrors.city}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />
                      <p className="text-xs text-muted-foreground">
                        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                        Os dados do cartão são usados apenas no navegador para tokenização segura com a Pagar.me e não são armazenados em nossos servidores.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {nextAction && <NextActionPanel action={nextAction} />}

              {errorMsg && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Coluna direita — resumo do pedido */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Serviço
                    </p>
                    <p className="font-medium text-foreground">
                      {order.service_name || order.service_id}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Código do catálogo: {order.service_id}
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-display text-2xl font-semibold text-primary">
                      {formatAmountFromCents(order.amount)}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Status do pedido
                    </p>
                    <Badge
                      className={`mt-1 ${TONE_CLASS[STATUS_TONE[order.status]]}`}
                      variant="outline"
                    >
                      {order.status === "processing" || order.status === "pending" || order.status === "waiting_payment" ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="mr-1 h-3 w-3" />
                      )}
                      {STATUS_LABEL[order.status]}
                    </Badge>
                  </div>

                  {pollingStopped ? (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Ainda estamos aguardando confirmação do pagamento.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        size="lg"
                        onClick={handleRefreshStatus}
                        disabled={creatingPayment}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Atualizar status
                      </Button>
                    </div>
                  ) : isStuckProcessing ? (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        PIX ou boleto gerado anteriormente. Não pagou? Clique abaixo para tentar outro método.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        size="lg"
                        onClick={handleRetry}
                        disabled={creatingPayment}
                      >
                        {creatingPayment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          "Não paguei — tentar outro método"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={handlePay}
                      disabled={!canPay || submittingRef.current}
                    >
                      {creatingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        "Finalizar pagamento"
                      )}
                    </Button>
                  )}


                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Pagamento processado por Pagar.me. O crédito é liberado somente após a
                    confirmação do pagamento.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PaymentOption({
  value,
  label,
  icon,
}: {
  value: CheckoutPaymentMethod;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <label
      htmlFor={`pm-${value}`}
      className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-3 text-sm transition hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
    >
      <RadioGroupItem id={`pm-${value}`} value={value} />
      {icon}
      <span className="font-medium">{label}</span>
    </label>
  );
}

function NextActionPanel({ action }: { action: PaymentNextAction }) {
  const copyPix = () => {
    if (!action.qr_code) return;
    void navigator.clipboard.writeText(action.qr_code);
    toast({ title: "Código PIX copiado" });
  };

  if (action.type === "pix") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pague com PIX</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {action.qr_code_url && (
            <img
              src={action.qr_code_url}
              alt="QR Code PIX"
              className="mx-auto h-56 w-56 rounded-md border border-border bg-white p-2"
            />
          )}
          {action.qr_code && (
            <div className="space-y-2">
              <Label className="text-xs">Copia e cola</Label>
              <div className="flex gap-2">
                <Input value={action.qr_code} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyPix}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Aguardando confirmação automática do pagamento. Esta tela atualiza sozinha.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (action.type === "boleto" && action.boleto_url) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Boleto gerado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <a href={action.boleto_url} target="_blank" rel="noreferrer">
              Abrir boleto
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            A confirmação ocorre em até 2 dias úteis após o pagamento.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (action.type === "redirect" && action.url) {
    return (
      <Card>
        <CardContent className="space-y-3 py-4">
          <Button asChild className="w-full">
            <a href={action.url}>Continuar pagamento</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tela de confirmação de pagamento (status = paid)
// ---------------------------------------------------------------------------

function ConfirmationScreen({
  order,
  onGoToBalance,
}: {
  order: CheckoutOrder;
  onGoToBalance: () => void;
}) {
  const paidAt = order.paid_at
    ? new Date(order.paid_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mx-auto max-w-lg">
      <Card className="overflow-hidden">
        {/* Faixa verde no topo */}
        <div className="bg-emerald-500 px-6 py-8 text-center text-white dark:bg-emerald-600">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h2 className="font-display text-2xl font-semibold">Pagamento confirmado!</h2>
          <p className="mt-1 text-sm opacity-80">Seu crédito já está disponível na plataforma.</p>
        </div>

        <CardContent className="space-y-4 p-6">
          {/* Detalhes do pedido */}
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-muted-foreground">Serviço</span>
              <span className="font-medium text-foreground">
                {order.service_name || order.service_id}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border py-3">
              <span className="text-muted-foreground">Valor pago</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatAmountFromCents(order.amount)}
              </span>
            </div>
            {paidAt && (
              <div className="flex items-center justify-between border-b border-border py-3">
                <span className="text-muted-foreground">Data</span>
                <span className="text-foreground">{paidAt}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3">
              <span className="text-muted-foreground">Referência</span>
              <span className="font-mono text-xs text-foreground">#{order.id}</span>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={onGoToBalance}>
            <Wallet className="mr-2 h-4 w-4" />
            Ver meu Dinheiro
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            Pagamento processado com segurança via Pagar.me.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tela de pedido cancelado ou estornado
// ---------------------------------------------------------------------------

function TerminalInfoScreen({
  order,
  onBack,
}: {
  order: CheckoutOrder;
  onBack: () => void;
}) {
  const isCanceled = order.status === "canceled";

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            {isCanceled ? (
              <XCircle className="h-7 w-7 text-muted-foreground" />
            ) : (
              <RefreshCw className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">
              {isCanceled ? "Pedido cancelado" : "Pagamento estornado"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isCanceled
                ? "Este pedido foi cancelado. Nenhum valor foi cobrado."
                : "O valor foi estornado e será devolvido conforme a política do método de pagamento."}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Referência</span>
              <span className="font-mono text-xs">#{order.id}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={onBack}>
            Voltar aos saldos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
