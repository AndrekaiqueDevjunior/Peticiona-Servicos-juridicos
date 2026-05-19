import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PriceInputProps {
  /** Texto do label acima do campo. */
  label?: string;
  /** Id do input (para `htmlFor`). */
  id?: string;
  /** Valor em centavos (número). */
  valueCents: number | null;
  /** Notifica o valor em centavos atualizado. */
  onChangeCents: (cents: number) => void;
  /** Texto auxiliar abaixo do campo (sobrescreve o preview padrão). */
  hint?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Atributo placeholder do input. */
  placeholder?: string;
  /** Se true, o campo permite ficar vazio (valor `null`/0). */
  allowEmpty?: boolean;
}

const BRL_FORMAT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function centsToBRL(cents: number): string {
  return BRL_FORMAT.format(cents / 100);
}

function centsToInputString(cents: number | null): string {
  if (cents == null || Number.isNaN(cents)) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Aceita "10", "10,5", "10,50", "10.50", "1.234,56", "1234.56".
 * Retorna o valor em centavos (inteiro). Retorna NaN se inválido.
 */
function parseBRLToCents(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  // Mantém apenas dígitos, ponto e vírgula.
  const cleaned = trimmed.replace(/[^\d.,-]/g, "");
  if (!cleaned) return NaN;
  // Remove separadores de milhar e normaliza decimal:
  //  - vírgula é o separador decimal canônico em PT-BR
  //  - se tiver vírgula, descarta os pontos (milhar) e troca vírgula por ponto
  //  - se NÃO tiver vírgula, mantém o ponto como decimal
  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * 100);
}

export function PriceInput({
  label,
  id,
  valueCents,
  onChangeCents,
  hint,
  required,
  disabled,
  className,
  placeholder = "0,00",
  allowEmpty = false,
}: PriceInputProps) {
  const [text, setText] = useState<string>(centsToInputString(valueCents));
  const [touched, setTouched] = useState(false);

  // Sincroniza quando o valor externo muda (ex.: reset do form).
  useEffect(() => {
    if (!touched) setText(centsToInputString(valueCents));
  }, [valueCents, touched]);

  const handleChange = (raw: string) => {
    setTouched(true);
    setText(raw);
    if (!raw.trim()) {
      if (allowEmpty) onChangeCents(0);
      return;
    }
    const cents = parseBRLToCents(raw);
    if (Number.isFinite(cents)) onChangeCents(cents);
  };

  const handleBlur = () => {
    if (!text.trim() && allowEmpty) {
      setText("");
      return;
    }
    const cents = parseBRLToCents(text);
    if (Number.isFinite(cents)) {
      setText(centsToInputString(cents));
      onChangeCents(cents);
    }
  };

  const previewCents = (() => {
    const parsed = parseBRLToCents(text);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  const previewText =
    hint !== undefined
      ? hint
      : previewCents !== null
        ? `${centsToBRL(previewCents)} (= ${previewCents} centavos)`
        : "Use vírgula para centavos: 10 = R$ 10,00; 10,50 = R$ 10,50.";

  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && (
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          required={required && !allowEmpty}
          disabled={disabled}
          className="pl-10 text-right tabular-nums"
        />
      </div>
      <p className="text-xs text-muted-foreground">{previewText}</p>
    </div>
  );
}

export { centsToBRL, centsToInputString, parseBRLToCents };
