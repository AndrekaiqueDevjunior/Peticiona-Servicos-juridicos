import { useState, useEffect } from "react";
import { CreditCard, QrCode, CheckCircle2, XCircle, Loader2, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { api, type SmokeChargeResult, type CreditPaymentConfig } from "@/lib/api";
import { createPagarmeCardToken } from "@/lib/pagarme";
import { maskDocument, maskPhone } from "@/lib/masks";

// ─── helpers ──────────────────────────────────────────────────────────────────

const digits = (v: string) => v.replace(/\D/g, "");

function maskCard(v: string) {
  return digits(v).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

// ─── card test numbers ────────────────────────────────────────────────────────

const TEST_CARDS = [
  { brand: "Visa", number: "4111111111111111" },
  { brand: "Mastercard", number: "5500000000000004" },
  { brand: "Amex", number: "378282246310005" },
];

// ─── types ────────────────────────────────────────────────────────────────────

interface CardForm {
  number: string; holder: string; expMonth: string; expYear: string; cvv: string;
  document: string; phone: string;
  street: string; addressNumber: string; neighborhood: string;
  city: string; state: string; zipCode: string;
}

interface PixForm { document: string; phone: string; }

const EMPTY_CARD: CardForm = {
  number: "", holder: "", expMonth: "", expYear: "", cvv: "",
  document: "", phone: "",
  street: "", addressNumber: "", neighborhood: "", city: "", state: "", zipCode: "",
};

const EMPTY_PIX: PixForm = { document: "", phone: "" };

// ─── result display ───────────────────────────────────────────────────────────

function ResultPanel({ result, onClear }: { result: SmokeChargeResult; onClear: () => void }) {
  const [copied, setCopied] = useState(false);
  const charge = result.charges?.[0];
  const tx = charge?.last_transaction;
  const paid = result.status === "paid" || charge?.status === "paid" || tx?.status === "captured";
  const isPix = Boolean(tx?.qr_code);

  const copyCode = () => {
    if (!tx?.qr_code) return;
    navigator.clipboard.writeText(tx.qr_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4 rounded-lg border p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {paid ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : isPix ? (
            <QrCode className="h-5 w-5 text-blue-500" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <span className="font-medium">
            {paid ? "Cobrança aprovada" : isPix ? "PIX gerado — aguardando pagamento" : "Cobrança pendente"}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>Limpar</Button>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div><span className="text-muted-foreground">Order ID</span><p className="break-all font-mono">{result.id}</p></div>
        <div><span className="text-muted-foreground">Código</span><p className="break-all font-mono">{result.code}</p></div>
        <div>
          <span className="text-muted-foreground">Status</span>
          <div className="mt-0.5">
            <Badge variant={paid ? "default" : "secondary"}>{result.status}</Badge>
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Valor</span>
          <p>{(result.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
        {charge?.id && (
          <div><span className="text-muted-foreground">Charge ID</span><p className="font-mono text-xs break-all">{charge.id}</p></div>
        )}
        {tx?.id && (
          <div><span className="text-muted-foreground">Transaction ID</span><p className="font-mono text-xs break-all">{tx.id}</p></div>
        )}
        {tx?.antifraud_response?.status && (
          <div><span className="text-muted-foreground">Antifraude</span><p>{tx.antifraud_response.status}</p></div>
        )}
      </div>

      {isPix && tx?.qr_code && (
        <>
          <Separator />
          <div className="space-y-3">
            {tx.qr_code_url && (
              <div className="flex justify-center">
                <img src={tx.qr_code_url} alt="QR Code PIX" className="h-48 w-48 rounded border" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Código Pix Copia e Cola</Label>
              <div className="flex gap-2">
                <Input readOnly value={tx.qr_code} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyCode}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {tx.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Expira em: {new Date(tx.expires_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function PaymentTest() {
  const { toast } = useToast();
  const [config, setConfig] = useState<CreditPaymentConfig | null>(null);
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD);
  const [pixForm, setPixForm] = useState<PixForm>(EMPTY_PIX);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmokeChargeResult | null>(null);

  useEffect(() => {
    api.payments.creditPackages().then(setConfig).catch(() => {
      toast({ title: "Aviso", description: "Não foi possível carregar config da Pagar.me.", variant: "destructive" });
    });
  }, [toast]);

  const setCard = (field: keyof CardForm, value: string) =>
    setCardForm((f) => ({ ...f, [field]: value }));
  const setPix = (field: keyof PixForm, value: string) =>
    setPixForm((f) => ({ ...f, [field]: value }));

  const fillTestCard = (number: string) => setCard("number", maskCard(number));

  const submitCard = async () => {
    const publicKey = config?.public_key ?? "";
    const isDry = config?.dry_run ?? false;

    if (!publicKey && !isDry) {
      toast({ title: "Erro", description: "Chave pública da Pagar.me não encontrada.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const expMonth = parseInt(digits(cardForm.expMonth), 10);
      const expYear = parseInt(
        cardForm.expYear.length === 2 ? `20${cardForm.expYear}` : cardForm.expYear,
        10,
      );

      const cardToken = isDry
        ? `dryrun_${Date.now()}`
        : await createPagarmeCardToken(publicKey, {
            number: digits(cardForm.number),
            holder_name: cardForm.holder.trim(),
            exp_month: expMonth,
            exp_year: expYear,
            cvv: digits(cardForm.cvv),
          });

      const data = await api.payments.smokeCharge({
        method: "credit_card",
        card_token: cardToken,
        customer: { document: digits(cardForm.document), phone: digits(cardForm.phone) },
        billing_address: {
          street: cardForm.street,
          number: cardForm.addressNumber,
          neighborhood: cardForm.neighborhood,
          city: cardForm.city,
          state: cardForm.state.toUpperCase(),
          zip_code: digits(cardForm.zipCode),
        },
      });
      setResult(data);
      toast({ title: "Cobrança criada", description: `Status: ${data.status}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Falhou", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submitPix = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await api.payments.smokeCharge({
        method: "pix",
        customer: { document: digits(pixForm.document), phone: digits(pixForm.phone) },
      });
      setResult(data);
      toast({ title: "PIX gerado", description: "Escaneie o QR Code para pagar." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Falhou", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teste de Integração Pagar.me</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cria uma cobrança real de R$ 1,00 para validar as chaves de produção.
        </p>
      </div>

      {config && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${config.dry_run ? "border-yellow-300 bg-yellow-50 text-yellow-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {config.dry_run
            ? "Modo dry-run ativo — nenhuma cobrança real será criada."
            : "Modo produção — a cobrança de R$ 1,00 será real. Cancele depois se necessário."}
          <Badge variant="outline" className="ml-auto text-xs">{config.dry_run ? "DRY RUN" : "PRODUÇÃO"}</Badge>
        </div>
      )}

      {result && <ResultPanel result={result} onClear={() => setResult(null)} />}

      <Tabs defaultValue="pix">
        <TabsList className="w-full">
          <TabsTrigger value="pix" className="flex-1 gap-2"><QrCode className="h-4 w-4" />PIX</TabsTrigger>
          <TabsTrigger value="card" className="flex-1 gap-2"><CreditCard className="h-4 w-4" />Cartão de Crédito</TabsTrigger>
        </TabsList>

        {/* ── PIX ── */}
        <TabsContent value="pix">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pagamento via PIX</CardTitle>
              <CardDescription>Gera um QR Code de R$ 1,00 válido por 5 minutos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>CPF / CNPJ</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={pixForm.document}
                    onChange={(e) => setPix("document", maskDocument(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(11) 99999-8888"
                    value={pixForm.phone}
                    onChange={(e) => setPix("phone", maskPhone(e.target.value))}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={submitPix} disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando PIX...</> : "Gerar PIX de R$ 1,00"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CARTÃO ── */}
        <TabsContent value="card">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pagamento via Cartão de Crédito</CardTitle>
              <CardDescription>
                O número do cartão é tokenizado direto no browser — nunca passa pelo servidor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* test card shortcuts */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cartões de teste (clique para preencher)</Label>
                <div className="flex flex-wrap gap-2">
                  {TEST_CARDS.map((c) => (
                    <Button key={c.brand} variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => fillTestCard(c.number)}>
                      {c.brand} ···· {c.number.slice(-4)}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* card data */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Número do cartão</Label>
                  <Input
                    placeholder="0000 0000 0000 0000"
                    value={cardForm.number}
                    onChange={(e) => setCard("number", maskCard(e.target.value))}
                    maxLength={19}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome no cartão</Label>
                  <Input
                    placeholder="NOME COMO NO CARTÃO"
                    value={cardForm.holder}
                    onChange={(e) => setCard("holder", e.target.value.toUpperCase())}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Mês</Label>
                    <Input placeholder="MM" maxLength={2} value={cardForm.expMonth}
                      onChange={(e) => setCard("expMonth", digits(e.target.value).slice(0, 2))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ano</Label>
                    <Input placeholder="AAAA" maxLength={4} value={cardForm.expYear}
                      onChange={(e) => setCard("expYear", digits(e.target.value).slice(0, 4))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CVV</Label>
                    <Input placeholder="000" maxLength={4} value={cardForm.cvv}
                      onChange={(e) => setCard("cvv", digits(e.target.value).slice(0, 4))} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* pagador */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Dados do pagador</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>CPF / CNPJ</Label>
                    <Input placeholder="000.000.000-00" value={cardForm.document}
                      onChange={(e) => setCard("document", maskDocument(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input placeholder="(11) 99999-8888" value={cardForm.phone}
                      onChange={(e) => setCard("phone", maskPhone(e.target.value))} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* endereço de cobrança */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Endereço de cobrança</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Rua</Label>
                    <Input placeholder="Rua Exemplo" value={cardForm.street}
                      onChange={(e) => setCard("street", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Número</Label>
                    <Input placeholder="123" value={cardForm.addressNumber}
                      onChange={(e) => setCard("addressNumber", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Bairro</Label>
                    <Input placeholder="Centro" value={cardForm.neighborhood}
                      onChange={(e) => setCard("neighborhood", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CEP</Label>
                    <Input placeholder="00000-000" maxLength={9} value={cardForm.zipCode}
                      onChange={(e) => setCard("zipCode", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Cidade</Label>
                    <Input placeholder="São Paulo" value={cardForm.city}
                      onChange={(e) => setCard("city", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Input placeholder="SP" maxLength={2} value={cardForm.state}
                      onChange={(e) => setCard("state", e.target.value.toUpperCase().slice(0, 2))} />
                  </div>
                </div>
              </div>

              <Button className="w-full" onClick={submitCard} disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> : "Cobrar R$ 1,00 no cartão"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
