import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthUser, type RegisterPayload } from "./api";
import { mapBackendRole, setRole } from "./roles";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "auth_user";
const TOKEN_KEY = "auth_token";

// Onde mora o token determina a persistência:
//  - localStorage  → "manter conectado" (sobrevive fechar o navegador, expira em 24h pela TTL do JWT)
//  - sessionStorage → "só nesta aba" (limpa ao fechar a aba)
const loadStoredUser = (): AuthUser | null => {
  try {
    const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

const loadStoredToken = (): string | null =>
  sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);

const clearAuthStorage = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = (token: string, nextUser: AuthUser, remember: boolean) => {
    // Garantir uma fonte única de verdade: limpa o storage oposto antes.
    if (remember) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    }
    setRole(mapBackendRole(nextUser.role));
    setUser(nextUser);
  };

  const clearAuth = () => {
    clearAuthStorage();
    setRole("cliente");
    setUser(null);
  };

  useEffect(() => {
    const token = loadStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    // Detecta onde o token mora para reescrever o user "fresco" no mesmo storage.
    const isSession = !!sessionStorage.getItem(TOKEN_KEY);

    const storedUser = loadStoredUser();
    if (storedUser) {
      setUser(storedUser);
      setRole(mapBackendRole(storedUser.role));
    }

    let cancelled = false;
    void api.me
      .get()
      .then((freshUser) => {
        if (cancelled) return;
        const target = isSession ? sessionStorage : localStorage;
        target.setItem(USER_KEY, JSON.stringify(freshUser));
        setRole(mapBackendRole(freshUser.role));
        setUser(freshUser);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuth();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string, remember = true) => {
    const { token, user: nextUser } = await api.auth.login(email, password);
    persist(token, nextUser, remember);
    return nextUser;
  };

  const register = async (payload: RegisterPayload) => {
    const { token, user: nextUser } = await api.auth.register(payload);
    persist(token, nextUser, true);
    await api.me.terms.accept().catch(() => undefined);
    return nextUser;
  };

  const logout = () => {
    clearAuth();
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
