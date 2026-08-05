import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  GraduationCap,
  Lock,
  Sparkles,
  Trophy,
} from "lucide-react";
import { DEFAULT_CURRICULUM_MODULES, type CurriculumModule } from "@/lib/domain";
import { useStudentReports, useStudents } from "@/hooks/useMusicData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader, EmptyState, StatusBadge } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "maestro_curriculum_";

export const Route = createFileRoute("/_authenticated/evolucao")({
  head: () => ({
    meta: [
      { title: "Evolução & Cronogramas · MusicCRM" },
      {
        name: "description",
        content: "Cronograma de ensino, linha do tempo de evolução e nível do aluno.",
      },
    ],
  }),
  component: EvolucaoPage,
});

const LEVEL_META: Record<string, { label: string; cls: string; icon: typeof Award }> = {
  Iniciante: {
    label: "Iniciante",
    cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    icon: Sparkles,
  },
  Intermediário: {
    label: "Intermediário",
    cls: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    icon: Award,
  },
  Avançado: {
    label: "Avançado",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    icon: Trophy,
  },
};

function levelMeta(level: string) {
  return (
    LEVEL_META[level] ?? {
      label: level,
      cls: "bg-secondary text-secondary-foreground",
      icon: Award,
    }
  );
}

function EvolucaoPage() {
  const { data: students = [] } = useStudents();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id ?? "");
  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  const { data: reports = [] } = useStudentReports(selectedStudent?.id ?? "");
  const [modules, setModules] = useState<CurriculumModule[]>(DEFAULT_CURRICULUM_MODULES);

  const loadModules = (studentId: string): CurriculumModule[] => {
    if (!studentId) return DEFAULT_CURRICULUM_MODULES;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + studentId);
      if (!raw) return DEFAULT_CURRICULUM_MODULES;
      const saved = JSON.parse(raw) as CurriculumModule[];
      if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_CURRICULUM_MODULES;
      return saved;
    } catch {
      return DEFAULT_CURRICULUM_MODULES;
    }
  };

  useEffect(() => {
    if (!selectedStudentId) return;
    setModules(loadModules(selectedStudentId));
  }, [selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + selectedStudentId, JSON.stringify(modules));
    } catch {
      void 0;
    }
  }, [modules, selectedStudentId]);

  const toggleTopic = (modId: string, topicId: string) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== modId) return mod;
        return {
          ...mod,
          topics: mod.topics.map((t) => (t.id === topicId ? { ...t, completed: !t.completed } : t)),
        };
      }),
    );
  };

  const totalTopics = modules.flatMap((m) => m.topics).length;
  const completedTopics = modules.flatMap((m) => m.topics).filter((t) => t.completed).length;
  const progressPercent = Math.round((completedTopics / (totalTopics || 1)) * 100);
  const level = Math.min(3, Math.floor(progressPercent / 33) + 1);

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader
        title="Evolução & Cronograma"
        description="Acompanhe o desenvolvimento pedagógico e o progresso dos alunos por módulo."
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Aluno:</span>
            <select
              value={selectedStudent?.id ?? ""}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.instrument})
                </option>
              ))}
            </select>
          </label>
        }
      />

      {selectedStudent && (
        <section className="panel relative overflow-hidden p-4 sm:p-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, var(--color-primary) 0, transparent 45%), radial-gradient(circle at 85% 80%, var(--color-primary) 0, transparent 40%)",
            }}
          />
          <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative shrink-0">
                <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-sm">
                  <AvatarImage
                    src={selectedStudent.photo_url ?? undefined}
                    alt={selectedStudent.name}
                  />
                  <AvatarFallback className="text-lg">
                    {selectedStudent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-emerald-500 text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{selectedStudent.name}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-3 w-3" /> Nível {level}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {selectedStudent.instrument} · {selectedStudent.goal || "Desenvolvimento Geral"}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">Progresso do Curso</span>
                <span className="font-bold tabular-nums text-primary">{progressPercent}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/10">
                <div
                  className="progress-animated h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {completedTopics} de {totalTopics} tópicos concluídos
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <GraduationCap className="h-5 w-5 text-primary" /> Jornada de aprendizado
          </h2>

          <div className="stagger space-y-3">
            {modules.map((mod, idx) => {
              const done = mod.topics.filter((t) => t.completed).length;
              const pct = Math.round((done / mod.topics.length) * 100);
              const meta = levelMeta(mod.level);
              const LevelIcon = meta.icon;
              const locked =
                idx > 0 &&
                pct === 0 &&
                (modules[idx - 1]?.topics.some((t) => !t.completed) ?? false);
              return (
                <article
                  key={mod.id}
                  className={cn(
                    "panel panel-hover p-4 transition-all duration-200 hover:shadow-panel",
                    pct === 100 && "border-emerald-500/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold tabular-nums",
                          pct === 100
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{mod.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {done} de {mod.topics.length} tópicos
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold",
                        meta.cls,
                      )}
                    >
                      <LevelIcon className="h-3 w-3" /> {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/10">
                      <div
                        className="progress-animated h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>

                  <ul className="mt-3 space-y-1">
                    {mod.topics.map((t) => (
                      <li
                        key={t.id}
                        onClick={() => toggleTopic(mod.id, t.id)}
                        className={cn(
                          "group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-accent/50",
                          locked && "opacity-50 cursor-not-allowed",
                        )}
                        aria-disabled={locked}
                      >
                        <span
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all duration-200",
                            t.completed
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-muted-foreground/30 group-hover:border-primary",
                          )}
                        >
                          {t.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm transition-colors",
                            t.completed
                              ? "text-muted-foreground line-through decoration-muted-foreground/40"
                              : "font-medium",
                          )}
                        >
                          {t.title}
                        </span>
                        {locked && (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Clock className="h-5 w-5 text-primary" /> Histórico de Aulas
          </h2>

          {reports.length === 0 ? (
            <EmptyState
              illustration="check"
              title="Nenhum relatório ainda"
              description={`Ao finalizar uma aula na Agenda, você pode registrar observações pedagógicas que aparecerão nesta timeline.`}
            />
          ) : (
            <div className="relative ml-3 space-y-4 border-l border-border pl-5">
              {reports.map((r) => (
                <div key={r.id} className="group relative animate-fade-in">
                  <span className="absolute -left-[25px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-primary bg-background transition-transform duration-200 group-hover:scale-125">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <div className="panel panel-hover space-y-2 p-4 transition-colors hover:border-primary/25">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        Registro
                      </Badge>
                    </div>
                    {r.content && <p className="text-sm font-medium">{r.content}</p>}
                    {r.exercises && (
                      <div className="rounded-lg border border-border bg-surface p-2.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Exercícios: </span>
                        {r.exercises}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
