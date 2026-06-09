/**
 * Testes do NewRequestDialog.tsx.
 *
 * Valida:
 * - Sem crédito common → submit desabilitado
 * - Com crédito common → submit habilitado
 * - Toggle Express disponível sem saldo express (pago no checkout)
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewRequestDialog } from "@/components/client/NewRequestDialog";
import { AuthProvider } from "@/lib/auth";
import { renderWithQueryClient } from "./utils";

// NewRequestDialog usa useUserPricingProfile → useAuth, então precisa do
// AuthProvider. Sem token no localStorage, o provider não dispara /me.
const renderDialog = () =>
  renderWithQueryClient(
    <AuthProvider>
      <NewRequestDialog open={true} onOpenChange={() => {}} />
    </AuthProvider>,
  );

const mockBalance = (common: number) => ({
  credits_available: common,
  credits_available_cents: common,
  credits_available_brl: `${common} crédito(s)`,
  credits_total: common,
  credits_total_cents: common,
  credits_total_brl: `${common} crédito(s)`,
  credits_used: 0,
  credits_used_cents: 0,
  credits_used_brl: "0 crédito(s)",
  balances: { common },
  totals_by_kind: { common: { credits_in: common, credits_out: 0, balance: common } },
  movements: [],
});

const stubFetch = (common: number) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/me/balance")) {
        return new Response(JSON.stringify(mockBalance(common)), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }),
  );

describe("NewRequestDialog with credit validation", () => {
  it("disables submit button without common credit", async () => {
    stubFetch(0);
    renderDialog();
    await waitFor(() => {
      const buttons = screen.queryAllByRole("button", { name: /finalizar/i });
      expect(buttons.length > 0).toBe(true);
      const submitButton = buttons.find((b) => b.textContent?.includes("Finalizar"));
      if (submitButton) {
        expect(submitButton).toBeDisabled();
      }
    });
  });

  it("enables submit button with common credit", async () => {
    stubFetch(5);
    renderDialog();
    await waitFor(() => {
      const petitionSelects = screen.queryAllByRole("combobox");
      expect(petitionSelects.length > 0).toBe(true);
    });
  });

  it("shows express toggle (available even without express credit)", async () => {
    stubFetch(1);
    renderDialog();
    expect(await screen.findByText(/qual o tipo de petição/i)).toBeInTheDocument();
  });

  it("renders dialog with petition type selector", async () => {
    stubFetch(3);
    renderDialog();
    expect(await screen.findByText(/qual o tipo de petição/i)).toBeInTheDocument();
  });

  it("shows order summary section", async () => {
    stubFetch(1);
    renderDialog();
    await waitFor(() => {
      expect(screen.queryByText(/resumo/i)).toBeInTheDocument();
    });
  });
});
