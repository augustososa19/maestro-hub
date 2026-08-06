import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Bell, CalendarClock, CalendarDays, Wallet } from "lucide-react";
import { useReminders, type Reminder } from "@/hooks/useReminders";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function ReminderBell() {
  const [open, setOpen] = useState(false);
  const reminders = useReminders();
  const navigate = useNavigate();

  const activeCount = reminders.filter((r) => r.severity !== "info").length;
  const count = reminders.length;

  const go = (r: Reminder) => {
    setOpen(false);
    navigate({ to: r.href, search: r.params } as never);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Lembretes (${count})`}
          className="press relative h-10 w-10"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold leading-none text-primary-foreground",
                activeCount > 0 ? "bg-destructive animate-pop-in" : "bg-primary",
              )}
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Lembretes</h3>
            <p className="text-xs text-muted-foreground">
              {count === 0
                ? "Nada pendente por enquanto"
                : `${count} pendência${count > 1 ? "s" : ""} para hoje`}
            </p>
          </div>
        </div>

        <ScrollArea className="max-h-[min(60vh,24rem)]">
          {reminders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Tudo em dia. Aulas e pagamentos acompanhados.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {reminders.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => go(r)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        r.kind === "lesson" && "bg-primary/10 text-primary",
                        r.kind === "event" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        r.kind === "payment" &&
                          (r.severity === "danger"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"),
                      )}
                    >
                      {r.kind === "lesson" ? (
                        <CalendarDays className="h-4 w-4" />
                      ) : r.kind === "event" ? (
                        <CalendarClock className="h-4 w-4" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{r.title}</span>
                        {r.severity === "danger" && (
                          <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                        )}
                      </span>
                      {r.subtitle && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {r.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {count > 0 && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground hover:text-foreground"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/agenda" } as never);
              }}
            >
              Ver agenda
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
