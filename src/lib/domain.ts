import type { Tables } from "@/integrations/supabase/types";

export type Student = Tables<"students">;
export type Lesson = Tables<"lessons">;
export type LessonReport = Tables<"lesson_reports">;
export type Material = Tables<"materials">;
export type Availability = Tables<"availability">;
export type BlockedDate = Tables<"blocked_dates">;
export type Profile = Tables<"profiles">;

export type LessonWithStudent = Lesson & { student: Pick<Student, "id" | "name" | "photo_url" | "instrument"> | null };

export const LESSON_TYPES = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "experimental", label: "Experimental" },
  { value: "reposicao", label: "Reposição" },
] as const;

export const LESSON_STATUS = [
  { value: "agendada", label: "Agendada" },
  { value: "realizada", label: "Realizada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "remarcada", label: "Remarcada" },
] as const;

export const STUDENT_STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "pausado", label: "Pausado" },
  { value: "inativo", label: "Inativo" },
] as const;

export const WEEKDAYS = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
] as const;

export const DURATIONS = [30, 45, 60, 90, 120];

export const INSTRUMENTS = [
  "Violão",
  "Guitarra",
  "Piano",
  "Teclado",
  "Baixo",
  "Bateria",
  "Canto",
  "Violino",
  "Saxofone",
  "Flauta",
  "Ukulele",
  "Outro",
];

export function labelOf(list: readonly { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? value;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function materialKindOf(mime: string): "pdf" | "imagem" | "video" | "audio" | "outro" {
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "outro";
}

export function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function lessonEnd(lesson: Pick<Lesson, "starts_at" | "duration_minutes">) {
  return new Date(new Date(lesson.starts_at).getTime() + lesson.duration_minutes * 60000);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

/** Verifica se um intervalo cabe na disponibilidade e fora de bloqueios. */
export function isWithinAvailability(
  start: Date,
  durationMinutes: number,
  availability: Availability[],
  blocks: BlockedDate[],
): { ok: boolean; reason?: string } {
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const dateStr = toDateInput(start);

  const blocked = blocks.find((b) => dateStr >= b.start_date && dateStr <= b.end_date);
  if (blocked) {
    return { ok: false, reason: `Dia bloqueado${blocked.reason ? `: ${blocked.reason}` : ""}.` };
  }

  const slots = availability.filter((a) => a.weekday === start.getDay());
  if (slots.length === 0) return { ok: false, reason: "Você não atende nesse dia da semana." };

  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = startMin + durationMinutes;
  const fits = slots.some((s) => startMin >= toMinutes(s.start_time) && endMin <= toMinutes(s.end_time));
  if (!fits) {
    const windows = slots.map((s) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`).join(", ");
    return { ok: false, reason: `Fora dos horários disponíveis (${windows}).` };
  }
  if (end.getDate() !== start.getDate()) return { ok: false, reason: "A aula ultrapassa o dia." };
  return { ok: true };
}

export function toMinutes(time: string) {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

export function toDateInput(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toTimeInput(date: Date) {
  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

export function fromDateTimeInput(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
