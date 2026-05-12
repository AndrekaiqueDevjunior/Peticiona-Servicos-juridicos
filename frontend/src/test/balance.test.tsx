import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Balance from "@/pages/client/Balance";
import { renderWithQueryClient } from "./utils";

describe("Balance", () => {
  it("mostra o saldo e as movimentações vindas do backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("/api/me/balance");
        return new Response(
          JSON.stringify({
            credits_available: 45000,
            credits_available_cents: 45000,
            credits_available_brl: "R$ 450,00",
            credits_total: 60000,
            credits_total_cents: 60000,
            credits_total_brl: "R$ 600,00",
            credits_used: 15000,
            credits_used_cents: 15000,
            credits_used_brl: "R$ 150,00",
            movements: [
              {
                type: "in",
                amount: 60000,
                amount_cents: 60000,
                amount_brl: "R$ 600,00",
                description: "Compra de créditos",
                source: "checkout",
                date: "2026-05-01T10:00:00Z",
              },
              {
                type: "out",
                amount: 15000,
                amount_cents: 15000,
                amount_brl: "R$ 150,00",
                description: "Consumo em pedido",
                source: "petition",
                date: "2026-05-01T12:00:00Z",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    renderWithQueryClient(<Balance />);

    expect((await screen.findAllByText("R$ 450,00")).length).toBeGreaterThan(0);
    expect(screen.getByText("Compra de créditos")).toBeInTheDocument();
    expect(screen.getByText("Consumo em pedido")).toBeInTheDocument();
  });
});
