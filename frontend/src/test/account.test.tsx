import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Account from "@/pages/client/Account";
import { renderWithQueryClient } from "./utils";

describe("Account", () => {
  it("carrega o perfil pela API e salva telefone e e-mail com PUT /api/me", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/me" && !init?.method) {
        return new Response(
          JSON.stringify({
            id: 3,
            full_name: "Andre Souza",
            email: "andre@peticiona.app.br",
            oab_number: "12345/SP",
            cpf: "123.456.789-00",
            phone: "(11) 98888-7777",
            role: "client",
            company_id: 9,
            is_active: true,
          }),
          { status: 200 },
        );
      }

      if (String(input) === "/api/me" && init?.method === "PUT") {
        expect(init.body).toBe(
          JSON.stringify({
            email: "novo@peticiona.app.br",
            phone: "(11) 97777-6666",
          }),
        );
        return new Response(
          JSON.stringify({
            id: 3,
            full_name: "Andre Souza",
            email: "novo@peticiona.app.br",
            oab_number: "12345/SP",
            cpf: "123.456.789-00",
            phone: "(11) 97777-6666",
            role: "client",
            company_id: 9,
            is_active: true,
          }),
          { status: 200 },
        );
      }

      throw new Error(`Requisição inesperada: ${String(input)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<Account />);

    expect(await screen.findByDisplayValue("Andre Souza")).toBeDisabled();

    const emailInput = screen.getByLabelText(/e-mail/i);
    const phoneInput = screen.getByLabelText(/telefone \/ whatsapp/i);

    fireEvent.change(emailInput, { target: { value: "novo@peticiona.app.br" } });
    fireEvent.change(phoneInput, { target: { value: "(11) 97777-6666" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/me",
        expect.objectContaining({
          method: "PUT",
        }),
      );
    });
  });
});
