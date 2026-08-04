import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock, Plus, UserPlus, Users } from "lucide-react";
import { useLessons, useStudents } from "@/hooks/useMusicData";
import { useShell } from "@/components/app/shell-context";
import { formatTime, formatWeekdayLong, relative } from "@/lib/dates";
import { initials, labelOf, LESSON_TYPES, type LessonWithStudent } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard · MusicCRM" },
      { name: "description", content: "Resumo das suas aulas, alunos e próximos compromissos." },
      { property: "og:title", content: "Dashboard · MusicCRM" },
      { property: "og:description", content: "Resumo das suas aulas, alunos e próximos compromissos." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const shell = useShell();
  const { data: lessons = [], isLoading } = useLessons();
  const { data: students = [] } = useStudents();

  const now = new Date();
  const todayStr = now.toDateString();
  const weekEnd = new Date(now.getTime() + 7 * 86400000);

  const today = lessons.filter(
    (l) => new Date(l.starts_at).toDateString() === todayStr && l.status !== "cancelada",
  );
  const week = lessons.filter((l) => {
    const d = new Date(l.starts_at);
    return d >= now && d <= weekEnd && l.status !== "cancelada";
  });
  const upcoming = week[0] ?? null;
  const activeStudents = students.filter((s) => s.status === "ativo");
  const doneThisMonth = lessons.filter(
    (l) => l.status === "realizada" && new Date(l.starts_at).getMonth() === now.getMonth(),
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Bom trabalho hoje</h1>
          <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{formatWeekdayLong(now)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => shell.openStudent()}>
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Aluno</span>
          </Button>
          <Button size="sm" onClick={() => shell.openLesson({})}>
            <Plus className="h-4 w-4" />
            Aula
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Aulas hoje" value={today.length} icon={Clock} />
        <Stat label="Próximos 7 dias" value={week.length} icon={CalendarDays} />
        <Stat label="Alunos ativos" value={activeStudents.length} icon={Users} />
        <Stat label="Realizadas no mês" value={doneThisMonth.length} icon={CheckCircle2} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Agenda de hoje</h2>
            <Link to="/agenda" className="text-xs text-muted-foreground hover:text-foreground">
              Ver agenda
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : today.length === 0 ? (
            <Empty text="Nenhuma aula agendada para hoje." action={() => shell.openLesson({})} />
          ) : (
            <ul className="space-y-2">
              {today.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} onOpen={() => shell.openLesson({ lesson })} onReport={() => shell.openReport(lesson)} />
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 text-sm font-semibold">Próxima aula</h2>
          {upcoming ? (
            <div className="space-y-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={upcoming.student?.photo_url ?? undefined} alt={upcoming.student?.name ?? ""} />
                  <AvatarFallback>{initials(upcoming.student?.name ?? "?")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{upcoming.student?.name ?? "Aula"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {upcoming.student?.instrument} · {upcoming.duration_minutes} min
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-surface p-3 text-sm">
                <p className="first-letter:uppercase">{formatWeekdayLong(upcoming.starts_at)}</p>
                <p className="mt-1 text-muted-foreground">
                  {formatTime(upcoming.starts_at)} · {relative(upcoming.starts_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{labelOf(LESSON_TYPES, upcoming.lesson_type)}</Badge>
                {upcoming.location && <Badge variant="outline">{upcoming.location}</Badge>}
              </div>
              {upcoming.student && (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link to="/alunos/$id" params={{ id: upcoming.student.id }}>
                    Abrir perfil do aluno
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Empty text="Sem aulas nos próximos dias." action={() => shell.openLesson({})} />
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );
}

function LessonRow({
  lesson,
  onOpen,
  onReport,
}: {
  lesson: LessonWithStudent;
  onOpen: () => void;
  onReport: () => void;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50">
      <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left">
        <span className="w-12 shrink-0 text-sm font-medium tabular-nums">{formatTime(lesson.starts_at)}</span>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={lesson.student?.photo_url ?? undefined} alt={lesson.student?.name ?? ""} />
          <AvatarFallback>{initials(lesson.student?.name ?? "?")}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{lesson.student?.name ?? "Aula"}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {labelOf(LESSON_TYPES, lesson.lesson_type)} · {lesson.duration_minutes} min
          </span>
        </span>
      </button>
      <Button variant="ghost" size="sm" onClick={onReport} className="shrink-0">
        Relatório
      </Button>
    </li>
  );
}

function Empty({ text, action }: { text: string; action: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={action}>
        <Plus className="h-4 w-4" /> Agendar aula
      </Button>
    </div>
  );
}
