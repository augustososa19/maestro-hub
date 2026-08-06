import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { useLessons, useStudents } from "@/hooks/useMusicData";
import { useShell } from "@/components/app/shell-context";
import { RemindersPanel } from "@/components/app/RemindersPanel";
import { formatTime, formatWeekdayLong, relative } from "@/lib/dates";
import {
  initials,
  labelOf,
  lessonInstrumentLabel,
  lessonStudentLabel,
  lessonStudents,
  LESSON_TYPES,
  type LessonWithStudent,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard, EmptyState } from "@/components/app/primitives";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard · MusicCRM" },
      { name: "description", content: "Resumo das suas aulas, alunos e próximos compromissos." },
      { property: "og:title", content: "Dashboard · MusicCRM" },
      {
        property: "og:description",
        content: "Resumo das suas aulas, alunos e próximos compromissos.",
      },
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
    return d >= now && d <= weekEnd && ["agendada", "remarcada"].includes(l.status);
  });
  const upcoming = week[0] ?? null;
  const upcomingStudents = upcoming ? lessonStudents(upcoming) : [];
  const upcomingPrimary = upcomingStudents[0];
  const activeStudents = students.filter((s) => s.status === "ativo");
  const doneThisMonth = lessons.filter((l) => {
    const date = new Date(l.starts_at);
    return (
      l.status === "realizada" &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader
        title="Bom trabalho hoje"
        description={formatWeekdayLong(now)}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => shell.openStudent()}>
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Aluno</span>
            </Button>
            <Button size="sm" onClick={() => shell.openLesson({})}>
              <Plus className="h-4 w-4" />
              Aula
            </Button>
          </>
        }
      />

      <section className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Aulas hoje" value={today.length} icon={Clock} tone="primary" />
        <StatCard label="Próximos 7 dias" value={week.length} icon={CalendarDays} tone="info" />
        <StatCard label="Alunos ativos" value={activeStudents.length} icon={Users} tone="success" />
        <StatCard
          label="Realizadas no mês"
          value={doneThisMonth.length}
          icon={CheckCircle2}
          tone="muted"
        />
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Lembretes do dia</h2>
            <p className="truncate text-xs text-muted-foreground">
              Aulas iminentes e mensalidades em aberto.
            </p>
          </div>
        </div>
        <RemindersPanel limit={4} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="panel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Agenda de hoje</h2>
            <Link
              to="/agenda"
              search={{ date: undefined, lessonId: undefined }}
              className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Ver agenda
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : today.length === 0 ? (
            <EmptyState
              illustration="calendar"
              title="Dia livre"
              description="Nenhuma aula agendada para hoje."
              action={
                <Button variant="outline" size="sm" onClick={() => shell.openLesson({})}>
                  <Plus className="h-4 w-4" /> Agendar aula
                </Button>
              }
              className="py-8"
            />
          ) : (
            <ul className="stagger space-y-2">
              {today.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  onOpen={() => shell.openLesson({ lesson })}
                  onReport={() => shell.openReport(lesson)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Próxima aula</h2>
          {upcoming ? (
            <div className="space-y-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-11 w-11 shrink-0 ring-1 ring-border">
                  <AvatarImage
                    src={upcomingPrimary?.photo_url ?? undefined}
                    alt={lessonStudentLabel(upcoming)}
                  />
                  <AvatarFallback>
                    {upcomingStudents.length > 1
                      ? upcomingStudents.length
                      : initials(upcomingPrimary?.name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{lessonStudentLabel(upcoming)}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {lessonInstrumentLabel(upcoming)} · {upcoming.duration_minutes} min
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3 text-sm transition-colors hover:border-primary/30">
                <p className="font-medium first-letter:uppercase">
                  {formatWeekdayLong(upcoming.starts_at)}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {formatTime(upcoming.starts_at)} · {relative(upcoming.starts_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{labelOf(LESSON_TYPES, upcoming.lesson_type)}</Badge>
                {upcoming.location && <Badge variant="outline">{upcoming.location}</Badge>}
              </div>
              {upcomingStudents.length === 1 && upcomingPrimary && (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link to="/alunos/$id" params={{ id: upcomingPrimary.id }}>
                    Abrir perfil do aluno
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <EmptyState
              illustration="calendar"
              title="Sem aulas agendadas"
              description="Nenhuma aula nos próximos dias."
              action={
                <Button variant="outline" size="sm" onClick={() => shell.openLesson({})}>
                  <Plus className="h-4 w-4" /> Agendar aula
                </Button>
              }
              className="py-8"
            />
          )}
        </div>
      </section>
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
  const students = lessonStudents(lesson);
  const primary = students[0];
  return (
    <li className="panel-hover group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-primary/25 hover:bg-accent/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      >
        <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-primary">
          {formatTime(lesson.starts_at)}
        </span>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={primary?.photo_url ?? undefined} alt={lessonStudentLabel(lesson)} />
          <AvatarFallback>
            {students.length > 1 ? students.length : initials(primary?.name ?? "?")}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{lessonStudentLabel(lesson)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {labelOf(LESSON_TYPES, lesson.lesson_type)} · {lesson.duration_minutes} min
          </span>
        </span>
      </button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReport}
        disabled={lesson.status === "cancelada" || new Date(lesson.starts_at) > new Date()}
        className="shrink-0 text-muted-foreground hover:text-primary"
      >
        Relatório
      </Button>
    </li>
  );
}
