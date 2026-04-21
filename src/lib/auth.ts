import { createElement, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthUser, type RegisterPayload } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.me
      .get()
      .then(setUser)
      .catch(() => localStorage.removeItem("auth_token"))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    localStorage.setItem("auth_token", res.token);
    setUser(res.user);
  };

  const register = async (payload: RegisterPayload) => {
    const res = await api.auth.register(payload);
    localStorage.setItem("auth_token", res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
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
