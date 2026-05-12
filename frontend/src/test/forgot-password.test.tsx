import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForgotPassword from "@/pages/ForgotPassword";
import { renderWithQueryClient } from "./utils";

describe("ForgotPassword", () => {
  it("solicita a recuperação pela API real e mostra a confirmação", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/auth/password-reset/request");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ email: "andre@peticiona.app.br" }));
      return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ForgotPassword />, { route: "/forgot-password" });

    fireEvent.change(screen.getByLabelText(/e-mail cadastrado/i), {
      target: { value: "andre@peticiona.app.br" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar link de redefinição/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/verifique seu e-mail/i)).toBeInTheDocument();
  });
});
