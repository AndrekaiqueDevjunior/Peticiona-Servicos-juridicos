import { createElement, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthUser, type RegisterPayload } from "./api";
import { roleFromBackend, setRole } from "./roles";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const next = await api.me.get();
        if (cancelled) return;
        localStorage.setItem(USER_KEY, JSON.stringify(next));
        setRole(roleFromBackend(next.role));
        setUser(next);
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem(USER_KEY);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = (next: AuthUser, token: string) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setRole(roleFromBackend(next.role));
    setUser(next);
  };

  const login = async (email: string, password: string) => {
    const response = await api.auth.login(email, password);
    persist(response.user, response.token);
  };

  const register = async (payload: RegisterPayload) => {
    const response = await api.auth.register(payload);
    persist(response.user, response.token);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem(USER_KEY);
    setRole("cliente");
    setUser(null);
  };

  return createElement(AuthContext.Provider, {
    value: { user, isAuthenticated: !!user, isLoading, login, register, logout },
    children,
  });
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
