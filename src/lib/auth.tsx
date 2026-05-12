import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthUser, type RegisterPayload } from "./api";
import { mapBackendRole, setRole } from "./roles";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "auth_user";
const TOKEN_KEY = "auth_token";

const loadStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

const clearAuthStorage = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = (token: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setRole(mapBackendRole(nextUser.role));
    setUser(nextUser);
  };

  const clearAuth = () => {
    clearAuthStorage();
    setRole("cliente");
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

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
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
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

  const login = async (email: string, password: string) => {
    const { token, user: nextUser } = await api.auth.login(email, password);
    persist(token, nextUser);
    return nextUser;
  };

  const register = async (payload: RegisterPayload) => {
    const { token, user: nextUser } = await api.auth.register(payload);
    persist(token, nextUser);
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
