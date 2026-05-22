import { afterEach, describe, expect, it, vi } from "vitest";

import { checkoutApi, tokenizeCard } from "@/lib/checkoutApi";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("checkoutApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("creates checkout orders with the catalog code and expected server amount", async () => {
    localStorage.setItem("auth_token", "token-123");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        order: {
          id: "77",
          user_id: 10,
          service_id: "plano_essencial",
          amount: 48000,
          currency: "BRL",
          status: "pending",
          pagarme_order_id: null,
          pagarme_charge_id: null,
          created_at: "2026-05-22T12:00:00Z",
          updated_at: "2026-05-22T12:00:00Z",
          paid_at: null,
          released_at: null,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await checkoutApi.createOrder("plano_essencial", 48000);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checkout/create-order",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        }),
        body: JSON.stringify({ service_id: "plano_essencial", expected_amount: 48000 }),
      }),
    );
  });

  it("sends tokenized card data to the backend without raw PAN or CVV", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        order: {
          id: "77",
          user_id: 10,
          service_id: "plano_essencial",
          amount: 48000,
          currency: "BRL",
          status: "processing",
          pagarme_order_id: "or_test",
          pagarme_charge_id: "ch_test",
          created_at: "2026-05-22T12:00:00Z",
          updated_at: "2026-05-22T12:00:00Z",
          paid_at: null,
          released_at: null,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await checkoutApi.createPayment({
      order_id: "77",
      payment_method: "credit_card",
      buyer: {
        fullName: "Comprador Cartao",
        email: "cartao@example.com",
        cpf: "11122233344",
        phone: "11988887777",
      },
      card: { token: "tok_test_123", installments: 3 },
      billing_address: {
        zip_code: "01310-000",
        street: "Avenida Paulista",
        street_number: "1000",
        complement: "Sala 12",
        neighborhood: "Bela Vista",
        city: "Sao Paulo",
        state: "SP",
        country: "BR",
      },
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit?.body as string);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checkout/create-payment",
      expect.objectContaining({ method: "POST" }),
    );
    expect(body.card).toEqual({ token: "tok_test_123", installments: 3 });
    expect(body.billing_address.street_number).toBe("1000");
    expect(JSON.stringify(body)).not.toContain("4111111111111111");
    expect(JSON.stringify(body).toLowerCase()).not.toContain("cvv");
  });

  it("tokenizes raw card data only against the public Pagar.me token endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ id: "tok_public_123" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await tokenizeCard("pk_test_abc", {
      number: "4111 1111 1111 1111",
      holder_name: "CLIENTE TESTE",
      exp_month: 12,
      exp_year: 2030,
      cvv: "123",
    });

    expect(token).toBe("tok_public_123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.pagar.me/core/v5/tokens?appId=pk_test_abc",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "card",
          card: {
            number: "4111111111111111",
            holder_name: "CLIENTE TESTE",
            exp_month: 12,
            exp_year: 2030,
            cvv: "123",
          },
        }),
      }),
    );
  });
});
