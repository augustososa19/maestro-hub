import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Bell, CalendarDays, Wallet } from "lucide-react";
import { useReminders, type Reminder } from "@/hooks/useReminders";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

export function RemindersPanel({ limit = 5 }: { limit?: number }) {
  const reminders = useReminders();
  const navigate = useNavigate();

  if (reminders.length === 0) {
    return (
      <EmptyState
        illustration="check"
        title="Tudo em dia"
        description="Sem aulas iminentes ou pagamentos pendentes."
        className="py-8"
      />
    );
  }

  const shown = reminders.slice(0, limit);

  return (
    <ul className="stagger space-y-2">
      {shown.map((r) => (
        <ReminderRow
          key={r.id}
          reminder={r}
          onGo={() => navigate({ to: r.href, params: r.params } as never)}
        />
      ))}
    </ul>
  );
}

function ReminderRow({ reminder, onGo }: { reminder: Reminder; onGo: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onGo}
        className="panel-hover group flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-all duration-200 hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
            reminder.kind === "lesson" && "bg-primary/10 text-primary",
            reminder.kind === "payment" &&
              (reminder.severity === "danger"
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"),
          )}
        >
          {reminder.kind === "lesson" ? (
            <CalendarDays className="h-4 w-4" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{reminder.title}</span>
            {reminder.severity === "danger" && (
              <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
            )}
          </span>
          {reminder.subtitle && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {reminder.subtitle}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function RemindersEmptyHint({ onNavigate }: { onNavigate: (to: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-6 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-muted-foreground">
        <Bell className="h-5 w-5" />
      </span>
      <p className="text-sm text-muted-foreground">
        Sem pendências agora. Lembretes de aulas iminentes e pagamentos aparecem aqui.
      </p>
      <Button variant="outline" size="sm" onClick={() => onNavigate("/agenda")}>
        Ver agenda
      </Button>
    </div>
  );
}
