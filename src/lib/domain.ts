import type { Tables } from "@/integrations/supabase/types";

export type Student = Tables<"students">;
export type Lesson = Tables<"lessons">;
export type LessonReport = Tables<"lesson_reports">;
export type Material = Tables<"materials">;
export type Availability = Tables<"availability">;
export type BlockedDate = Tables<"blocked_dates">;
export type Profile = Tables<"profiles">;
export type StudentProgram = Tables<"student_programs">;
export type LessonParticipant = Tables<"lesson_participants">;

export type LessonParticipantWithStudent = LessonParticipant & {
  student: Pick<Student, "id" | "name" | "photo_url" | "instrument">;
  program: Pick<StudentProgram, "id" | "instrument"> | null;
};

export type LessonWithStudent = Lesson & {
  student: Pick<Student, "id" | "name" | "photo_url" | "instrument"> | null;
  participants: LessonParticipantWithStudent[];
};

export function lessonStudents(lesson: LessonWithStudent) {
  const participants = lesson.participants?.map((participant) => participant.student) ?? [];
  if (participants.length > 0) return participants;
  return lesson.student ? [lesson.student] : [];
}

export function lessonStudentLabel(lesson: LessonWithStudent) {
  const students = lessonStudents(lesson);
  if (students.length === 0) return "Aula";
  if (students.length === 1) return students[0]!.name;
  if (students.length === 2) return students.map((student) => student.name).join(" e ");
  return `${students[0]!.name}, ${students[1]!.name} +${students.length - 2}`;
}

export function lessonInstrumentLabel(lesson: LessonWithStudent) {
  const instruments = [
    ...new Set(
      lesson.participants
        ?.map((participant) => participant.program?.instrument ?? participant.student.instrument)
        .filter(Boolean) ?? [],
    ),
  ];
  if (instruments.length > 0) return instruments.join(", ");
  return lesson.student?.instrument ?? "Música";
}

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

/** Verifica se um intervalo cabe na disponibilidade e fora de bloqueios.
 * Se nenhuma disponibilidade estiver configurada, libera qualquer horário.
 */
export function isWithinAvailability(
  start: Date,
  durationMinutes: number,
  availability: Availability[],
  blocks: BlockedDate[],
): { ok: boolean; reason?: string } {
  const dateStr = toDateInput(start);

  // Verifica bloqueios explícitos de datas (férias, feriados, etc.)
  const blocked = blocks.find((b) => dateStr >= b.start_date && dateStr <= b.end_date);
  if (blocked) {
    return { ok: false, reason: `Dia bloqueado${blocked.reason ? `: ${blocked.reason}` : ""}.` };
  }

  // Se o professor não configurou disponibilidade, libera qualquer horário
  if (availability.length === 0) return { ok: true };

  const slots = availability.filter((a) => a.weekday === start.getDay());
  if (slots.length === 0)
    return {
      ok: false,
      reason:
        "Você não atende nesse dia da semana. Configure sua disponibilidade em Configurações.",
    };

  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = startMin + durationMinutes;
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const fits = slots.some(
    (s) => startMin >= toMinutes(s.start_time) && endMin <= toMinutes(s.end_time),
  );
  if (!fits) {
    const windows = slots
      .map((s) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`)
      .join(", ");
    return { ok: false, reason: `Fora dos horários disponíveis (${windows}).` };
  }
  if (end.getDate() !== start.getDate()) return { ok: false, reason: "A aula ultrapassa o dia." };
  return { ok: true };
}

export function toMinutes(time: string) {
  const [h = "0", m = "0"] = time.split(":");
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
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export type FinancialTransaction = {
  id: string;
  teacher_id?: string;
  lesson_id?: string | null;
  student_id?: string | null;
  student_program_id?: string | null;
  student_name?: string | null;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  category: "mensalidade" | "aula_avulsa" | "pacote" | "equipamento" | "outros";
  status: "pago" | "pendente" | "atrasado";
  payment_method: "pix" | "dinheiro" | "cartao" | "transferencia";
  origin?: "manual" | "mensalidade_automatica" | "aula_avulsa" | "pacote";
  competence_date: string;
  due_date: string;
  paid_at?: string | null;
  source_key?: string | null;
};

export type CurriculumModule = {
  id: string;
  title: string;
  level: "Iniciante" | "Intermediário" | "Avançado";
  topics: { id: string; title: string; completed: boolean }[];
};

export const DEFAULT_CURRICULUM_MODULES: CurriculumModule[] = [
  {
    id: "mod-1",
    title: "Módulo 1: Fundamentos & Postura",
    level: "Iniciante",
    topics: [
      { id: "t1", title: "Postura & Empunhadura Correta", completed: true },
      { id: "t2", title: "Afinação & Leitura de Tablaturas/Partitura Básica", completed: true },
      { id: "t3", title: "Primeiros Acordes Abertos (C, G, D, Em, Am)", completed: true },
      { id: "t4", title: "Primeiros Padrões de Ritmo & Levadas Básicas", completed: false },
    ],
  },
  {
    id: "mod-2",
    title: "Módulo 2: Harmonia & Escalas",
    level: "Intermediário",
    topics: [
      { id: "t5", title: "Escala Pentatônica Maior & Menor", completed: false },
      { id: "t6", title: "Construção do Campo Harmônico Maior", completed: false },
      { id: "t7", title: "Pestanas & Acordes com Sétima (Maj7, m7, 7)", completed: false },
      { id: "t8", title: "Introdução à Improvisação e Percepção Auditiva", completed: false },
    ],
  },
  {
    id: "mod-3",
    title: "Módulo 3: Repertório & Expressão",
    level: "Avançado",
    topics: [
      {
        id: "t9",
        title: "Repertório Solo & Técnicas Avançadas (Bend, Slide, Legato)",
        completed: false,
      },
      { id: "t10", title: "Modos Gregos (Jônio, Dórico, Miódio...)", completed: false },
      { id: "t11", title: "Arranjos Próprios & Interpretação Musical", completed: false },
    ],
  },
];
