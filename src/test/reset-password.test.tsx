import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResetPassword from "@/pages/esqueciminhasenha/ResetPassword";
import { renderWithQueryClient } from "./utils";

describe("ResetPassword", () => {
  it("confirma a nova senha pela API real usando o token da URL", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/auth/password-reset/confirm");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({
          token: "token-real",
          password: "Senha@123",
        }),
      );
      return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ResetPassword />, { route: "/reset-password?token=token-real" });

    fireEvent.change(screen.getByLabelText(/^Nova senha$/i), {
      target: { value: "Senha@123" },
    });
    fireEvent.change(screen.getByLabelText(/^Confirmar nova senha$/i), {
      target: { value: "Senha@123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
