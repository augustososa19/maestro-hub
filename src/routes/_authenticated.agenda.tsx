import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarOff, ChevronLeft, ChevronRight, Plus, Copy } from "lucide-react";
import { useLessons } from "@/hooks/useMusicData";
import { useShell } from "@/components/app/shell-context";
import {
  addDays,
  formatMonthTitle,
  formatTime,
  isSameDay,
  isSameMonth,
  monthGrid,
  weekDays,
} from "@/lib/dates";
import { WEEKDAYS, labelOf, LESSON_TYPES, type LessonWithStudent } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, Segmented } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda · MusicCRM" },
      { name: "description", content: "Visualize e organize suas aulas por dia, semana e mês." },
      { property: "og:title", content: "Agenda · MusicCRM" },
      {
        property: "og:description",
        content: "Visualize e organize suas aulas por dia, semana e mês.",
      },
    ],
  }),
  component: Agenda,
});

type View = "dia" | "semana" | "mes";

function Agenda() {
  const shell = useShell();
  const [anchor, setAnchor] = useState(new Date());
  const [view, setView] = useState<View>("semana");
  const { data: lessons = [] } = useLessons();

  const days = useMemo(() => {
    if (view === "semana") return weekDays(anchor);
    if (view === "dia") return [anchor];
    return monthGrid(anchor);
  }, [anchor, view]);

  const lessonsOf = (day: Date) =>
    lessons
      .filter((l) => isSameDay(new Date(l.starts_at), day))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const shift = (dir: number) => {
    setAnchor((d) =>
      view === "mes" ? addDays(d, dir * 7) : addDays(d, view === "semana" ? dir * 7 : dir),
    );
  };

  const goToday = () => {
    const today = new Date();
    if (view === "mes") setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    else setAnchor(today);
  };

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
                onClick={goToday}
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
                { value: "dia", label: "Dia" },
                { value: "semana", label: "Semana" },
                { value: "mes", label: "Mês" },
              ]}
              className="hidden sm:flex"
            />
          </>
        }
      />

      {view === "mes" ? (
        <MonthView
          anchor={anchor}
          lessonsOf={lessonsOf}
          onDayClick={(day) => {
            setAnchor(day);
            setView("dia");
          }}
        />
      ) : (
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
              <DayCard
                key={day.toISOString()}
                day={day}
                items={items}
                today={today}
                done={done}
                onNew={() => shell.openLesson({ startsAt: atNine(day) })}
                onOpen={(lesson) => shell.openLesson({ lesson })}
                onDuplicate={(lesson) => shell.openLesson({ lesson, duplicate: true })}
              />
            );
          })}
        </div>
      )}

      {view !== "mes" && totalLessons === 0 && (
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

function MonthView({
  anchor,
  lessonsOf,
  onDayClick,
}: {
  anchor: Date;
  lessonsOf: (day: Date) => LessonWithStudent[];
  onDayClick: (day: Date) => void;
}) {
  const grid = monthGrid(anchor);
  const today = new Date();

  return (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div
            key={d.value}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <span className="hidden sm:inline">{d.label}</span>
            <span className="sm:hidden">{d.short}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day) => {
          const inMonth = isSameMonth(day, anchor);
          const todayFlag = isSameDay(day, today);
          const items = lessonsOf(day);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "group relative min-h-[72px] cursor-pointer border-b border-r border-border p-1.5 transition-colors sm:min-h-[96px] sm:p-2",
                !inMonth && "bg-muted/30 opacity-50",
                todayFlag && "bg-primary/[0.04]",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors",
                    todayFlag
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground group-hover:bg-accent"
                        : "text-muted-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                {items.length > 0 && (
                  <span className="hidden text-[10px] font-medium text-muted-foreground sm:block">
                    {items.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 2).map((lesson) => (
                  <div
                    key={lesson.id}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                      lesson.status === "cancelada"
                        ? "line-through opacity-50"
                        : lesson.status === "realizada"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-primary/15 text-primary",
                    )}
                    title={`${lesson.student?.name ?? "Aula"} · ${formatTime(lesson.starts_at)}`}
                  >
                    <span className="font-semibold">{formatTime(lesson.starts_at)}</span>{" "}
                    <span className="hidden lg:inline">{lesson.student?.name ?? "Aula"}</span>
                  </div>
                ))}
                {items.length > 2 && (
                  <p className="px-1 text-[10px] font-medium text-muted-foreground">
                    +{items.length - 2} aula{items.length - 2 > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayCard({
  day,
  items,
  today,
  done,
  onNew,
  onOpen,
  onDuplicate,
}: {
  day: Date;
  items: LessonWithStudent[];
  today: boolean;
  done: number;
  onNew: () => void;
  onOpen: (l: LessonWithStudent) => void;
  onDuplicate: (l: LessonWithStudent) => void;
}) {
  return (
    <section
      className={cn(
        "panel panel-hover flex min-h-36 flex-col p-3 transition-all duration-200",
        today ? "border-primary/40 bg-primary/[0.03] shadow-panel" : "hover:border-primary/20",
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
          onClick={onNew}
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
                onClick={() => onOpen(lesson)}
                onDuplicate={onDuplicate}
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
}

function LessonCard({
  lesson,
  onClick,
  onDuplicate,
}: {
  lesson: LessonWithStudent;
  onClick: () => void;
  onDuplicate: (l: LessonWithStudent) => void;
}) {
  const cancelled = lesson.status === "cancelada";
  const done = lesson.status === "realizada";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "press group relative w-full cursor-pointer rounded-lg border border-border bg-surface p-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        cancelled && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(lesson);
        }}
        className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary group-hover:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Duplicar aula"
        aria-label="Duplicar aula"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
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
      <p className={cn("mt-1 truncate pr-5 text-sm font-medium", cancelled && "line-through")}>
        {lesson.student?.name ?? "Aula"}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge variant={done ? "secondary" : "outline"} className="text-[10px]">
          {labelOf(LESSON_TYPES, lesson.lesson_type)}
        </Badge>
      </div>
    </div>
  );
}

function atNine(day: Date) {
  const start = new Date(day);
  start.setHours(9, 0, 0, 0);
  return start;
}
