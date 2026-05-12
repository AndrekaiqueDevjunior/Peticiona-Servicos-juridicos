import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth";

const freshUser = {
  id: 7,
  full_name: "Clarissa Anjos",
  email: "clarissa@peticiona.app.br",
  oab_number: "12345/SP",
  cpf: "123.456.789-00",
  phone: "(11) 99999-9999",
  role: "client" as const,
  company_id: 10,
  is_active: true,
};

function Consumer({ onReady }: { onReady?: (ctx: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();

  useEffect(() => {
    onReady?.(auth);
  }, [auth, onReady]);

  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user-email">{auth.user?.email ?? ""}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  it("hidrata o usuário real a partir do token salvo e do GET /api/me", async () => {
    localStorage.setItem("auth_token", "persisted-token");
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        ...freshUser,
        email: "antigo@peticiona.app.br",
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("/api/me");
        return new Response(JSON.stringify(freshUser), { status: 200 });
      }),
    );

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("user-email")).toHaveTextContent(freshUser.email);
    expect(JSON.parse(localStorage.getItem("auth_user") ?? "{}")).toMatchObject(freshUser);
  });

  it("faz login real, persiste token e atualiza o usuário", async () => {
    let currentAuth: ReturnType<typeof useAuth> | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/auth/login");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            token: "jwt-token",
            user: freshUser,
          }),
          { status: 200 },
        );
      }),
    );

    render(
      <AuthProvider>
        <Consumer onReady={(ctx) => (currentAuth = ctx)} />
      </AuthProvider>,
    );

    await waitFor(() => expect(currentAuth?.isLoading).toBe(false));
    await act(async () => {
      await currentAuth?.login("clarissa@peticiona.app.br", "Senha@123");
    });

    expect(localStorage.getItem("auth_token")).toBe("jwt-token");
    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("user-email")).toHaveTextContent(freshUser.email);
    });
  });
});
