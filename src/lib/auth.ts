import { createElement, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type AuthUser, type RegisterPayload } from "./api";

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

const loadStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      const stored = loadStoredUser();
      if (stored) setUser(stored);
      else localStorage.removeItem("auth_token");
    }
    setIsLoading(false);
  }, []);

  const persist = (next: AuthUser) => {
    localStorage.setItem("auth_token", `mock-${next.id}-${Date.now()}`);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  };

  const login = async (email: string, _password: string) => {
    const stored = loadStoredUser();
    const next: AuthUser =
      stored && stored.email.toLowerCase() === email.toLowerCase()
        ? stored
        : {
            id: Date.now(),
            full_name: stored?.full_name ?? email.split("@")[0],
            email,
            oab_number: stored?.oab_number ?? null,
          };
    persist(next);
  };

  const register = async (payload: RegisterPayload) => {
    if (payload.password !== payload.confirm_password) {
      throw new Error("As senhas não conferem.");
    }
    const next: AuthUser = {
      id: Date.now(),
      full_name: payload.full_name,
      email: payload.email,
      oab_number: payload.oab_number,
    };
    persist(next);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem(USER_KEY);
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
