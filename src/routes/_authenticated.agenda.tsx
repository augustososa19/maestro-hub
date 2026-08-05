import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarOff, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useLessons } from "@/hooks/useMusicData";
import { useShell } from "@/components/app/shell-context";
import { addDays, formatMonthTitle, formatTime, isSameDay, weekDays } from "@/lib/dates";
import { WEEKDAYS, labelOf, LESSON_TYPES, type LessonWithStudent } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, Segmented } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda · MusicCRM" },
      { name: "description", content: "Visualize e organize suas aulas por semana e por dia." },
      { property: "og:title", content: "Agenda · MusicCRM" },
      {
        property: "og:description",
        content: "Visualize e organize suas aulas por semana e por dia.",
      },
    ],
  }),
  component: Agenda,
});

function Agenda() {
  const shell = useShell();
  const [anchor, setAnchor] = useState(new Date());
  const [view, setView] = useState<"semana" | "dia">("semana");
  const { data: lessons = [] } = useLessons();

  const days = useMemo(() => (view === "semana" ? weekDays(anchor) : [anchor]), [anchor, view]);

  const lessonsOf = (day: Date) =>
    lessons
      .filter((l) => isSameDay(new Date(l.starts_at), day))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const shift = (dir: number) => setAnchor((d) => addDays(d, view === "semana" ? dir * 7 : dir));

  const totalLessons = days.reduce((acc, d) => acc + lessonsOf(d).length, 0);

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader
        title="Agenda"
        description={formatMonthTitle(anchor)}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border bg-surface">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => shift(-1)}
                aria-label="Anterior"
                className="press"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnchor(new Date())}
                className="press text-xs font-medium"
              >
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => shift(1)}
                aria-label="Próximo"
                className="press"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "semana", label: "Semana" },
                { value: "dia", label: "Dia" },
              ]}
              className="hidden sm:flex"
            />
          </>
        }
      />

      <div
        className={cn(
          "stagger grid gap-3",
          view === "semana"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
            : "grid-cols-1",
        )}
      >
        {days.map((day) => {
          const items = lessonsOf(day);
          const today = isSameDay(day, new Date());
          const done = items.filter((l) => l.status === "realizada").length;
          return (
            <section
              key={day.toISOString()}
              className={cn(
                "panel-hover panel flex min-h-36 flex-col p-3 transition-all duration-200",
                today
                  ? "border-primary/40 bg-primary/[0.03] shadow-panel"
                  : "hover:border-primary/20",
                items.length === 0 && !today && "opacity-80",
              )}
            >
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {WEEKDAYS[day.getDay()]?.short}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-bold tabular-nums leading-none",
                      today ? "text-primary" : "text-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {today && (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="press h-7 w-7 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  aria-label="Nova aula neste dia"
                  onClick={() => {
                    const start = new Date(day);
                    start.setHours(9, 0, 0, 0);
                    shell.openLesson({ startsAt: start });
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 py-3">
                  <CalendarOff className="h-4 w-4 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground/60">Livre</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1">
                    {items.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        onClick={() => shell.openLesson({ lesson })}
                      />
                    ))}
                  </div>
                  {items.length > 1 && (
                    <p className="mt-auto pt-2 text-[11px] font-medium text-muted-foreground">
                      {done > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {done} realizada{done > 1 ? "s" : ""} ·{" "}
                        </span>
                      )}
                      {items.length} aula{items.length > 1 ? "s" : ""}
                    </p>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>

      {totalLessons === 0 && (
        <EmptyState
          illustration="calendar"
          title="Sem aulas neste período"
          description="Agende uma aula para começar a organizar sua semana."
          action={
            <Button size="sm" onClick={() => shell.openLesson({})}>
              <Plus className="h-4 w-4" /> Nova aula
            </Button>
          }
          className="py-8"
        />
      )}
    </div>
  );
}

function LessonCard({ lesson, onClick }: { lesson: LessonWithStudent; onClick: () => void }) {
  const cancelled = lesson.status === "cancelada";
  const done = lesson.status === "realizada";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press group w-full rounded-lg border border-border bg-surface p-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        cancelled && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            done
              ? "text-emerald-600 dark:text-emerald-400"
              : cancelled
                ? "text-muted-foreground"
                : "text-primary",
          )}
        >
          {formatTime(lesson.starts_at)}
        </span>
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            done ? "bg-emerald-500" : cancelled ? "bg-muted-foreground/40" : "bg-primary",
          )}
        />
      </div>
      <p className={cn("mt-1 truncate text-sm font-medium", cancelled && "line-through")}>
        {lesson.student?.name ?? "Aula"}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge variant={done ? "secondary" : "outline"} className="text-[10px]">
          {labelOf(LESSON_TYPES, lesson.lesson_type)}
        </Badge>
      </div>
    </button>
  );
}
