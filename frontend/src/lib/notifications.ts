// Store local (mock) de notificações do cliente.
// Apenas exibição — não são clicáveis nem geram navegação.
import { useSyncExternalStore } from "react";

export type NotificationKind = "pedido_criado" | "pedido_concluido";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  createdAtISO: string;
  read: boolean;
}

interface NotificationsState {
  items: AppNotification[];
}

const STORAGE_KEY = "peticiona:notifications:v1";
const initialState: NotificationsState = { items: [] };

const load = (): NotificationsState => {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
};

let state: NotificationsState = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
};

const setState = (updater: (s: NotificationsState) => NotificationsState) => {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => state;

export const useNotifications = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const notify = (
  kind: NotificationKind,
  title: string,
  description: string,
) => {
  setState((s) => ({
    items: [
      {
        id: newId(),
        kind,
        title,
        description,
        createdAtISO: new Date().toISOString(),
        read: false,
      },
      ...s.items,
    ].slice(0, 50),
  }));
};

export const markAllRead = () => {
  setState((s) => ({
    items: s.items.map((n) => (n.read ? n : { ...n, read: true })),
  }));
};

export const clearNotifications = () => {
  setState(() => ({ items: [] }));
};
