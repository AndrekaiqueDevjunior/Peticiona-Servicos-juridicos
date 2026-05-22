import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Mail, ReceiptText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api, type AdminNotification } from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "peticiona:admin-notifications-read:v1";

const readListeners = new Set<() => void>();
let readIds = new Set<string>();

const loadReadIds = () => {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
};

const persistReadIds = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readIds).slice(-500)));
  } catch {
    // noop
  }
};

const subscribeRead = (listener: () => void) => {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
};

const getReadSnapshot = () => {
  readIds = loadReadIds();
  return Array.from(readIds).join("|");
};

const markRead = (ids: string[]) => {
  ids.forEach((id) => readIds.add(id));
  persistReadIds();
  readListeners.forEach((listener) => listener());
};

const clearRead = () => {
  readIds = new Set();
  persistReadIds();
  readListeners.forEach((listener) => listener());
};

const iconFor = (notification: AdminNotification) => {
  if (notification.severity === "danger") return AlertTriangle;
  if (notification.source === "resend") return Mail;
  if (notification.severity === "success") return CheckCircle2;
  return ReceiptText;
};

const toneFor = (notification: AdminNotification) => {
  if (notification.severity === "danger") return "text-destructive bg-destructive/10";
  if (notification.severity === "success") return "text-accent bg-accent/15";
  if (notification.severity === "warning") return "text-primary bg-primary/10";
  return "text-muted-foreground bg-secondary";
};

export function AdminNotificationsBell() {
  const readSnapshot = useSyncExternalStore(subscribeRead, getReadSnapshot, getReadSnapshot);
  const readSet = useMemo(() => new Set(readSnapshot ? readSnapshot.split("|") : []), [readSnapshot]);
  const { data, isFetching } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => api.admin.notifications(),
    refetchInterval: 30_000,
  });

  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((notification) => !readSet.has(notification.id));

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && unread.length > 0) {
          setTimeout(() => markRead(unread.map((notification) => notification.id)), 150);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell className={cn("h-5 w-5", isFetching && "animate-pulse")} />
          {unread.length > 0 && (
            <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Notificações</p>
            <p className="text-xs text-muted-foreground">
              Webhooks Pagar.me e Resend
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={clearRead} aria-label="Reabrir notificações">
            <CheckCheck className="h-4 w-4" />
          </Button>
        </div>

        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum evento recente de webhook.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {notifications.map((notification) => {
              const Icon = iconFor(notification);
              const isUnread = !readSet.has(notification.id);
              return (
                <li
                  key={notification.id}
                  className={cn("flex items-start gap-3 px-4 py-3", isUnread && "bg-accent-soft/40")}
                >
                  <div className={cn("mt-0.5 rounded-md p-1.5", toneFor(notification))}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {notification.title}
                      </p>
                      {isUnread && <span className="h-2 w-2 rounded-full bg-destructive" />}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.description}
                    </p>
                    <p className="mt-1 text-[10px] uppercase text-muted-foreground/70">
                      {notification.source} · {notification.event_type} ·{" "}
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
