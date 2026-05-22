import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContactForm from "@/components/landing/ContactForm";
import { renderWithQueryClient } from "./utils";

describe("ContactForm", () => {
  it("envia o formulário público para a API de contato", async () => {
    const payload = {
      name: "Maria Cliente",
      whatsapp: "(11) 98888-7777",
      email: "maria@peticiona.app.br",
      message: "Gostaria de contratar uma petição inicial.",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/contact");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify(payload));
      return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/^Nome$/i), { target: { value: payload.name } });
    fireEvent.change(screen.getByLabelText(/^WhatsApp$/i), {
      target: { value: payload.whatsapp },
    });
    fireEvent.change(screen.getByLabelText(/^E-mail$/i), { target: { value: payload.email } });
    fireEvent.change(screen.getByLabelText(/^Mensagem$/i), {
      target: { value: payload.message },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar mensagem/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText(/^Nome$/i)).toHaveValue("");
  });
});
