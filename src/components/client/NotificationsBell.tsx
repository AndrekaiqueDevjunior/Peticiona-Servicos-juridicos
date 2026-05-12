import { Bell, CheckCircle2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useNotifications,
  markAllRead,
  clearNotifications,
  type AppNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

const iconFor = (n: AppNotification) =>
  n.kind === "pedido_concluido" ? CheckCircle2 : FileText;

export const NotificationsBell = () => {
  const { items } = useNotifications();
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && unread > 0) {
          // Marca como lidas ao abrir
          setTimeout(markAllRead, 150);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificações"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground"
              aria-label={`${unread} novas`}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notificações</p>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearNotifications}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Você ainda não tem notificações.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((n) => {
              const Icon = iconFor(n);
              return (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3",
                    !n.read && "bg-accent-soft/40",
                  )}
                >
                  <div className="mt-0.5 rounded-md bg-secondary p-1.5">
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        n.kind === "pedido_concluido"
                          ? "text-accent"
                          : "text-primary",
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {n.description}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {formatDistanceToNow(new Date(n.createdAtISO), {
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
};
