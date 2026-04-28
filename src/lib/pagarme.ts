export interface PagarmeCardTokenPayload {
  number: string;
  holder_name: string;
  exp_month: number;
  exp_year: number;
  cvv: string;
}

export async function createPagarmeCardToken(
  publicKey: string,
  card: PagarmeCardTokenPayload,
): Promise<string> {
  const res = await fetch(
    `https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(publicKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "card", card }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.message ||
      data?.errors?.[0]?.message ||
      "Não foi possível validar o cartão.";
    throw new Error(message);
  }
  const token = data?.id || data?.token;
  if (!token || typeof token !== "string") {
    throw new Error("Token de cartão não retornado pela Pagar.me.");
  }
  return token;
}
