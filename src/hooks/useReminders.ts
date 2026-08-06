import { useMemo } from "react";
import { differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { useFinancialTransactions, useLessons } from "@/hooks/useMusicData";
import { lessonStudentLabel, type FinancialTransaction } from "@/lib/domain";

export type ReminderKind = "lesson" | "payment";
export type ReminderSeverity = "info" | "warning" | "danger";

export type Reminder = {
  id: string;
  kind: ReminderKind;
  severity: ReminderSeverity;
  title: string;
  subtitle?: string;
  href: string;
  params?: Record<string, string>;
};

const SOON_WINDOW_MINUTES = 90;

export function useReminders() {
  const { data: lessons = [] } = useLessons();
  const { data: transactions = [] } = useFinancialTransactions();

  return useMemo(() => {
    const now = new Date();
    const reminders: Reminder[] = [];

    const todayLessons = lessons
      .filter((l) => l.status !== "cancelada" && l.status !== "realizada")
      .filter((l) => {
        const d = new Date(l.starts_at);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    for (const lesson of todayLessons) {
      const start = new Date(lesson.starts_at);
      const mins = differenceInMinutes(start, now);
      const student = lessonStudentLabel(lesson);
      const time = format(start, "HH:mm", { locale: ptBR });

      if (mins >= 0 && mins <= SOON_WINDOW_MINUTES) {
        reminders.push({
          id: `lesson-soon-${lesson.id}`,
          kind: "lesson",
          severity: "danger",
          title: `Aula em ${mins === 0 ? "agora" : `${mins} min`}`,
          subtitle: `${student} · ${time} · ${lesson.location ?? "local a definir"}`,
          href: "/agenda",
        });
      } else if (mins > SOON_WINDOW_MINUTES) {
        reminders.push({
          id: `lesson-today-${lesson.id}`,
          kind: "lesson",
          severity: "info",
          title: `Aula hoje às ${time}`,
          subtitle: `${student} · ${lesson.duration_minutes} min${lesson.location ? ` · ${lesson.location}` : ""}`,
          href: "/agenda",
        });
      }
    }

    const txList = transactions as FinancialTransaction[];

    for (const tx of txList) {
      if (tx.type !== "receita") continue;

      if (tx.status === "atrasado") {
        reminders.push({
          id: `payment-late-${tx.id}`,
          kind: "payment",
          severity: "danger",
          title: `Pagamento em atraso`,
          subtitle: `${tx.student_name ?? tx.description} · R$ ${tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          href: "/financeiro",
        });
        continue;
      }

      if (tx.status === "pendente") {
        const due = new Date(tx.due_date + "T00:00:00");
        const diff = differenceInMinutes(due, now);
        if (diff <= 0) {
          reminders.push({
            id: `payment-due-${tx.id}`,
            kind: "payment",
            severity: "warning",
            title: "Mensalidade vence hoje",
            subtitle: `${tx.student_name ?? tx.description} · R$ ${tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            href: "/financeiro",
          });
        } else if (diff <= 5 * 24 * 60) {
          const days = Math.ceil(diff / (24 * 60));
          reminders.push({
            id: `payment-soon-${tx.id}`,
            kind: "payment",
            severity: "warning",
            title: days === 1 ? "Mensalidade vence amanhã" : `Vence em ${days} dias`,
            subtitle: `${tx.student_name ?? tx.description} · R$ ${tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            href: "/financeiro",
          });
        }
      }
    }

    return reminders.sort((a, b) => {
      const order: Record<ReminderSeverity, number> = { danger: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [lessons, transactions]);
}

export function paymentDueSoon(tx: FinancialTransaction, now = new Date()) {
  if (tx.type !== "receita" || tx.status === "pago") return false;
  const due = new Date(tx.due_date + "T00:00:00");
  return differenceInMinutes(due, now) <= 5 * 24 * 60;
}
