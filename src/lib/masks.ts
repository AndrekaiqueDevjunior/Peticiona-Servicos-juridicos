// Máscaras e validações de campos brasileiros.

export const maskCPF = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

/** OAB no formato "123456/SP" (número + UF). */
export const maskOAB = (value: string) => {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 6);
  const letters = raw.replace(/[^A-Z]/g, "").slice(0, 2);
  if (!digits) return "";
  if (!letters) return digits;
  return `${digits}/${letters}`;
};

/** Valida CPF pelos dígitos verificadores. */
export const isValidCPF = (cpf: string) => {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(d[i]) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
};
