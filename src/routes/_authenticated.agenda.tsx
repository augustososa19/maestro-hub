import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useLessons } from "@/hooks/useMusicData";
import { useShell } from "@/components/app/shell-context";
import { addDays, formatMonthTitle, formatTime, isSameDay, weekDays } from "@/lib/dates";
import { WEEKDAYS, labelOf, LESSON_TYPES, type LessonWithStudent } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda · MusicCRM" },
      { name: "description", content: "Visualize e organize suas aulas por semana e por dia." },
      { property: "og:title", content: "Agenda · MusicCRM" },
      { property: "og:description", content: "Visualize e organize suas aulas por semana e por dia." },
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

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 truncate text-sm capitalize text-muted-foreground">{formatMonthTitle(anchor)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center rounded-lg border border-border">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="hidden rounded-lg border border-border p-0.5 sm:flex">
            {(["semana", "dia"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm capitalize transition-colors",
                  view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div
        className={cn(
          "grid gap-3",
          view === "semana" ? "sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" : "grid-cols-1",
        )}
      >
        {days.map((day) => {
          const items = lessonsOf(day);
          const today = isSameDay(day, new Date());
          return (
            <section
              key={day.toISOString()}
              className={cn("panel flex min-h-40 flex-col p-3", today && "ring-1 ring-ring")}
            >
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                    {WEEKDAYS[day.getDay()]?.short}
                  </p>
                  <p className={cn("text-lg font-semibold tabular-nums", today && "text-primary")}>
                    {day.getDate()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
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

              <div className="space-y-2">
                {items.length === 0 && <p className="text-xs text-muted-foreground">Livre</p>}
                {items.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} onClick={() => shell.openLesson({ lesson })} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
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
        "w-full rounded-lg border-l-2 bg-surface p-2 text-left transition-colors hover:bg-accent",
        cancelled && "opacity-55 line-through",
        done ? "border-l-success" : "border-l-primary",
      )}
    >
      <p className="truncate text-xs font-medium tabular-nums">{formatTime(lesson.starts_at)}</p>
      <p className="truncate text-sm">{lesson.student?.name ?? "Aula"}</p>
      <Badge variant="outline" className="mt-1 text-[10px]">
        {labelOf(LESSON_TYPES, lesson.lesson_type)}
      </Badge>
    </button>
  );
}
