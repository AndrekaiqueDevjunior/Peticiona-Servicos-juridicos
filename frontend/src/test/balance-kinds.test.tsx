/**
 * Testes da página Balance.tsx — saldo único de créditos comuns.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Balance from "@/pages/client/Balance";
import { renderWithQueryClient } from "./utils";

const makeBalanceResponse = (overrides = {}) => ({
  credits_available: 5,
  credits_available_cents: 5,
  credits_available_brl: "5 crédito(s)",
  credits_total: 10,
  credits_total_cents: 10,
  credits_total_brl: "10 crédito(s)",
  credits_used: 5,
  credits_used_cents: 5,
  credits_used_brl: "5 crédito(s)",
  balances: { common: 5 },
  totals_by_kind: { common: { credits_in: 10, credits_out: 5, balance: 5 } },
  movements: [],
  ...overrides,
});

const stubFetch = (balancePayload: object) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/me/balance")) {
        return new Response(JSON.stringify(balancePayload), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }),
  );

describe("Balance page", () => {
  it("renders credits available card", async () => {
    stubFetch(makeBalanceResponse());
    renderWithQueryClient(<Balance />);
    expect((await screen.findAllByText(/crédito/i)).length).toBeGreaterThan(0);
  });

  it("shows correct common balance", async () => {
    stubFetch(makeBalanceResponse({ credits_available: 10, balances: { common: 10 } }));
    renderWithQueryClient(<Balance />);
    expect(await screen.findByText("10")).toBeInTheDocument();
  });

  it("shows movements", async () => {
    stubFetch(
      makeBalanceResponse({
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
    );
    renderWithQueryClient(<Balance />);
    expect(await screen.findByText("Créditos comprados")).toBeInTheDocument();
    expect(screen.getByText("Petição criada")).toBeInTheDocument();
  });

  it("marks legacy_cents movements as 'Histórico'", async () => {
    stubFetch(
      makeBalanceResponse({
        credits_available: 0,
        balances: { common: 0 },
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
    );
    renderWithQueryClient(<Balance />);
    await waitFor(() => {
      expect(screen.getByText("Saldo pré-migração")).toBeInTheDocument();
    });
    expect(screen.getByText(/Histórico/i)).toBeInTheDocument();
  });
});
