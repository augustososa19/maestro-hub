import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const opts = { locale: ptBR } as const;

export function formatDate(date: string | Date) {
  return format(new Date(date), "dd 'de' MMM yyyy", opts);
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "dd MMM · HH:mm", opts);
}

export function formatTime(date: string | Date) {
  return format(new Date(date), "HH:mm", opts);
}

export function formatWeekdayLong(date: string | Date) {
  return format(new Date(date), "EEEE, dd 'de' MMMM", opts);
}

export function formatMonthTitle(date: Date) {
  return format(date, "MMMM 'de' yyyy", opts);
}

export function relative(date: string | Date) {
  return formatDistanceToNowStrict(new Date(date), { locale: ptBR, addSuffix: true });
}

export function weekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 0 });
}

export function weekDays(date: Date) {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Grade completa de um mês (preenchendo início/fim de semana) para a visão mês. */
export function monthGrid(date: Date) {
  const first = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
  const last = endOfWeek(endOfMonth(date), { weekStartsOn: 0 });
  const days: Date[] = [];
  let cursor = first;
  while (cursor <= last) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export { isSameDay, isSameMonth, addDays, startOfMonth, endOfMonth };
