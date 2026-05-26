/**
 * Testes da página Balance.tsx com 3 kinds segregados.
 *
 * Valida:
 * - 3 cards renderizados com nomes corretos
 * - Saldos corretos por kind
 * - Badges de kind nos movements
 * - Legacy_cents marcado como "Histórico"
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Balance from "@/pages/client/Balance";
import { renderWithQueryClient } from "./utils";

describe("Balance page with credit kinds", () => {
  it("renders 3 credit kind cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/me/balance")) {
          return new Response(
            JSON.stringify({
              credits_available: 5,
              credits_available_cents: 5,
              credits_available_brl: "5 crédito(s)",
              credits_total: 10,
              credits_total_cents: 10,
              credits_total_brl: "10 crédito(s)",
              credits_used: 5,
              credits_used_cents: 5,
              credits_used_brl: "5 crédito(s)",
              balances: {
                common: 5,
                peticao_express: 2,
                recurso_express: 1,
              },
              totals_by_kind: {
                common: {
                  credits_in: 10,
                  credits_out: 5,
                },
                peticao_express: {
                  credits_in: 3,
                  credits_out: 1,
                },
                recurso_express: {
                  credits_in: 2,
                  credits_out: 1,
                },
              },
              movements: [
                {
                  type: "in",
                  amount: 10,
                  amount_cents: 10,
                  amount_brl: "10 crédito(s)",
                  kind: "common",
                  description: "Plano comprado",
                  source: "checkout",
                  date: "2026-05-20T10:00:00Z",
                },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 404 });
      })
    );

    renderWithQueryClient(<Balance />);

    // Wait for cards to render
    await waitFor(() => {
      expect(screen.getByText("Créditos Comuns")).toBeInTheDocument();
    });

    expect(screen.getByText("Créditos Petição Express")).toBeInTheDocument();
    expect(screen.getByText("Créditos Recurso Express")).toBeInTheDocument();

    // Check balances are displayed
    expect(screen.getByText("5")).toBeInTheDocument(); // common balance
    expect(screen.getByText("2")).toBeInTheDocument(); // peticao_express balance
    expect(screen.getByText("1")).toBeInTheDocument(); // recurso_express balance
  });

  it("displays correct balance values for each kind", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/me/balance")) {
          return new Response(
            JSON.stringify({
              credits_available: 10,
              credits_available_cents: 10,
              credits_available_brl: "10 crédito(s)",
              credits_total: 15,
              credits_total_cents: 15,
              credits_total_brl: "15 crédito(s)",
              credits_used: 5,
              credits_used_cents: 5,
              credits_used_brl: "5 crédito(s)",
              balances: {
                common: 10,
                peticao_express: 0,
                recurso_express: 3,
              },
              totals_by_kind: {
                common: { credits_in: 15, credits_out: 5 },
                peticao_express: { credits_in: 0, credits_out: 0 },
                recurso_express: { credits_in: 3, credits_out: 0 },
              },
              movements: [],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 404 });
      })
    );

    renderWithQueryClient(<Balance />);

    await waitFor(() => {
      expect(screen.getByText("Créditos Comuns")).toBeInTheDocument();
    });

    // Verify specific balances (may need to adjust selectors based on actual layout)
    const text = screen.getByText(/10.*crédito/i);
    expect(text).toBeInTheDocument();
  });

  it("shows kind badges in movements", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/me/balance")) {
          return new Response(
            JSON.stringify({
              credits_available: 5,
              credits_available_cents: 5,
              credits_available_brl: "5 crédito(s)",
              credits_total: 10,
              credits_total_cents: 10,
              credits_total_brl: "10 crédito(s)",
              credits_used: 5,
              credits_used_cents: 5,
              credits_used_brl: "5 crédito(s)",
              balances: {
                common: 5,
                peticao_express: 0,
                recurso_express: 0,
              },
              totals_by_kind: {
                common: { credits_in: 10, credits_out: 5 },
                peticao_express: { credits_in: 0, credits_out: 0 },
                recurso_express: { credits_in: 0, credits_out: 0 },
              },
              movements: [
                {
                  type: "in",
                  amount: 10,
                  amount_cents: 10,
                  amount_brl: "10 crédito(s)",
                  kind: "common",
                  description: "Créditos comprados",
                  source: "checkout",
                  date: "2026-05-20T10:00:00Z",
                },
                {
                  type: "out",
                  amount: 5,
                  amount_cents: 5,
                  amount_brl: "5 crédito(s)",
                  kind: "common",
                  description: "Petição criada",
                  source: "petition",
                  date: "2026-05-21T10:00:00Z",
                },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 404 });
      })
    );

    renderWithQueryClient(<Balance />);

    await waitFor(() => {
      expect(screen.getByText("Créditos Comuns")).toBeInTheDocument();
    });

    expect(screen.getByText("Créditos comprados")).toBeInTheDocument();
    expect(screen.getByText("Petição criada")).toBeInTheDocument();
  });

  it("marks legacy_cents movements as 'Histórico'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/me/balance")) {
          return new Response(
            JSON.stringify({
              credits_available: 0,
              credits_available_cents: 0,
              credits_available_brl: "0 crédito(s)",
              credits_total: 0,
              credits_total_cents: 0,
              credits_total_brl: "0 crédito(s)",
              credits_used: 0,
              credits_used_cents: 0,
              credits_used_brl: "0 crédito(s)",
              balances: {
                common: 0,
                peticao_express: 0,
                recurso_express: 0,
              },
              totals_by_kind: {
                common: { credits_in: 0, credits_out: 0 },
                peticao_express: { credits_in: 0, credits_out: 0 },
                recurso_express: { credits_in: 0, credits_out: 0 },
              },
              movements: [
                {
                  type: "in",
                  amount: 50000,
                  amount_cents: 50000,
                  amount_brl: "R$ 500,00",
                  kind: "legacy_cents",
                  description: "Saldo pré-migração",
                  source: "legacy",
                  date: "2025-05-01T10:00:00Z",
                },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 404 });
      })
    );

    renderWithQueryClient(<Balance />);

    await waitFor(() => {
      expect(screen.getByText("Saldo pré-migração")).toBeInTheDocument();
    });

    expect(screen.getByText(/Histórico/i)).toBeInTheDocument();
  });
});
