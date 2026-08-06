import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  Check,
  Clock,
  GraduationCap,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { DEFAULT_CURRICULUM_MODULES, type CurriculumModule } from "@/lib/domain";
import { useStudentPrograms, useStudentReports, useStudents } from "@/hooks/useMusicData";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, EmptyState } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "maestro_curriculum_";

type ModuleEditor = { id?: string; title: string; level: CurriculumModule["level"] };
type TopicEditor = { moduleId: string; id?: string; title: string };

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

function loadModules(storageKey: string): CurriculumModule[] {
  if (!storageKey) return DEFAULT_CURRICULUM_MODULES;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_CURRICULUM_MODULES;
    const saved = JSON.parse(raw) as CurriculumModule[];
    if (!Array.isArray(saved)) return DEFAULT_CURRICULUM_MODULES;
    return saved;
  } catch {
    return DEFAULT_CURRICULUM_MODULES;
  }
}

function EvolucaoPage() {
  const { data: students = [] } = useStudents();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id ?? "");
  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];
  const { data: programs = [] } = useStudentPrograms(selectedStudent?.id);
  const { data: reports = [] } = useStudentReports(selectedStudent?.id ?? "");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [modules, setModules] = useState<CurriculumModule[]>(DEFAULT_CURRICULUM_MODULES);
  const [moduleEditor, setModuleEditor] = useState<ModuleEditor | null>(null);
  const [topicEditor, setTopicEditor] = useState<TopicEditor | null>(null);
  const studentPrograms = programs.filter((program) => program.student_id === selectedStudent?.id);
  const selectedProgram =
    studentPrograms.find((program) => program.id === selectedProgramId) ??
    studentPrograms.find((program) => program.is_primary) ??
    studentPrograms[0];
  const storageKey = selectedStudent?.id
    ? selectedProgram
      ? `${STORAGE_PREFIX}${selectedStudent.id}_${selectedProgram.id}`
      : `${STORAGE_PREFIX}${selectedStudent.id}`
    : "";

  useEffect(() => {
    if (students.length > 0 && !students.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(students[0]!.id);
    }
  }, [selectedStudentId, students]);

  useEffect(() => {
    const availablePrograms = programs.filter(
      (program) => program.student_id === selectedStudent?.id,
    );
    const primaryProgram =
      availablePrograms.find((program) => program.is_primary) ?? availablePrograms[0];
    setSelectedProgramId((current) =>
      availablePrograms.some((program) => program.id === current)
        ? current
        : (primaryProgram?.id ?? ""),
    );
  }, [selectedStudent?.id, programs]);

  useEffect(() => {
    if (!storageKey) return;
    const legacyKey = selectedStudent?.id ? `${STORAGE_PREFIX}${selectedStudent.id}` : "";
    try {
      const hasProgramProgress = localStorage.getItem(storageKey) !== null;
      const canMigrateLegacy = selectedProgram?.is_primary && legacyKey && legacyKey !== storageKey;
      if (!hasProgramProgress && canMigrateLegacy && localStorage.getItem(legacyKey)) {
        const legacyModules = loadModules(legacyKey);
        localStorage.setItem(storageKey, JSON.stringify(legacyModules));
        setModules(legacyModules);
        return;
      }
    } catch {
      void 0;
    }
    setModules(loadModules(storageKey));
  }, [selectedProgram?.is_primary, selectedStudent?.id, storageKey]);

  const updateModules = (update: (current: CurriculumModule[]) => CurriculumModule[]) => {
    setModules((prev) => {
      const next = update(prev);
      try {
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  };

  const toggleTopic = (modId: string, topicId: string) => {
    updateModules((current) =>
      current.map((mod) =>
        mod.id === modId
          ? {
              ...mod,
              topics: mod.topics.map((topic) =>
                topic.id === topicId ? { ...topic, completed: !topic.completed } : topic,
              ),
            }
          : mod,
      ),
    );
  };

  const saveModule = (event: React.FormEvent) => {
    event.preventDefault();
    if (!moduleEditor?.title.trim()) return;
    updateModules((current) =>
      moduleEditor.id
        ? current.map((module) =>
            module.id === moduleEditor.id
              ? { ...module, title: moduleEditor.title.trim(), level: moduleEditor.level }
              : module,
          )
        : [
            ...current,
            {
              id: crypto.randomUUID(),
              title: moduleEditor.title.trim(),
              level: moduleEditor.level,
              topics: [],
            },
          ],
    );
    setModuleEditor(null);
  };

  const removeModule = (module: CurriculumModule) => {
    if (!window.confirm(`Excluir o módulo “${module.title}” e todos os seus tópicos?`)) return;
    updateModules((current) => current.filter((item) => item.id !== module.id));
  };

  const saveTopic = (event: React.FormEvent) => {
    event.preventDefault();
    if (!topicEditor?.title.trim()) return;
    updateModules((current) =>
      current.map((module) =>
        module.id === topicEditor.moduleId
          ? {
              ...module,
              topics: topicEditor.id
                ? module.topics.map((topic) =>
                    topic.id === topicEditor.id
                      ? { ...topic, title: topicEditor.title.trim() }
                      : topic,
                  )
                : [
                    ...module.topics,
                    { id: crypto.randomUUID(), title: topicEditor.title.trim(), completed: false },
                  ],
            }
          : module,
      ),
    );
    setTopicEditor(null);
  };

  const removeTopic = (moduleId: string, topicId: string) => {
    if (!window.confirm("Excluir este tópico do cronograma?")) return;
    updateModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? { ...module, topics: module.topics.filter((topic) => topic.id !== topicId) }
          : module,
      ),
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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">Aluno:</span>
              <select
                value={selectedStudent?.id ?? ""}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring sm:max-w-52"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.instrument})
                  </option>
                ))}
              </select>
            </label>
            {studentPrograms.length > 1 && (
              <label className="flex min-w-0 items-center gap-2 text-sm">
                <span className="shrink-0 text-muted-foreground">Programa:</span>
                <select
                  value={selectedProgram?.id ?? ""}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring sm:max-w-48"
                >
                  {studentPrograms.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.instrument}
                      {program.is_primary ? " (principal)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
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
                    <Sparkles className="h-3 w-3" /> Nível calculado {level}
                  </span>
                  {selectedProgram?.level && (
                    <Badge variant="outline" className="text-xs">
                      Nível cadastrado: {selectedProgram.level}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 break-words text-sm text-muted-foreground">
                  {selectedProgram?.instrument ?? selectedStudent.instrument} ·{" "}
                  {selectedProgram?.goal || selectedStudent.goal || "Desenvolvimento Geral"}
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <GraduationCap className="h-5 w-5 text-primary" /> Jornada de aprendizado
            </h2>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedStudent}
              onClick={() => setModuleEditor({ title: "", level: "Iniciante" })}
            >
              <Plus className="h-4 w-4" /> Módulo
            </Button>
          </div>

          <div className="stagger space-y-3">
            {modules.length === 0 && (
              <EmptyState
                illustration="check"
                title="Cronograma vazio"
                description="Adicione um módulo para montar uma jornada personalizada para este aluno."
              />
            )}
            {modules.map((mod, idx) => {
              const done = mod.topics.filter((t) => t.completed).length;
              const pct = Math.round((done / (mod.topics.length || 1)) * 100);
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
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold",
                          meta.cls,
                        )}
                      >
                        <LevelIcon className="h-3 w-3" /> {meta.label}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Editar ${mod.title}`}
                        onClick={() =>
                          setModuleEditor({ id: mod.id, title: mod.title, level: mod.level })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Excluir ${mod.title}`}
                        onClick={() => removeModule(mod)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
                        onClick={locked ? undefined : () => toggleTopic(mod.id, t.id)}
                        className={cn(
                          "group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-accent/50",
                          locked && "cursor-not-allowed opacity-50 hover:bg-transparent",
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
                        <span className="flex shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Editar ${t.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setTopicEditor({ moduleId: mod.id, id: t.id, title: t.title });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label={`Excluir ${t.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeTopic(mod.id, t.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-muted-foreground"
                    onClick={() => setTopicEditor({ moduleId: mod.id, title: "" })}
                  >
                    <Plus className="h-4 w-4" /> Adicionar tópico
                  </Button>
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

      <Dialog open={moduleEditor !== null} onOpenChange={(open) => !open && setModuleEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{moduleEditor?.id ? "Editar módulo" : "Novo módulo"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveModule}>
            <div className="space-y-2">
              <Label htmlFor="module-title">Nome do módulo</Label>
              <Input
                id="module-title"
                autoFocus
                required
                value={moduleEditor?.title ?? ""}
                onChange={(event) =>
                  setModuleEditor((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-level">Nível</Label>
              <select
                id="module-level"
                value={moduleEditor?.level ?? "Iniciante"}
                onChange={(event) =>
                  setModuleEditor((current) =>
                    current
                      ? { ...current, level: event.target.value as CurriculumModule["level"] }
                      : current,
                  )
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {Object.keys(LEVEL_META).map((levelOption) => (
                  <option key={levelOption} value={levelOption}>
                    {levelOption}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModuleEditor(null)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar módulo</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={topicEditor !== null} onOpenChange={(open) => !open && setTopicEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{topicEditor?.id ? "Editar tópico" : "Novo tópico"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveTopic}>
            <div className="space-y-2">
              <Label htmlFor="topic-title">Nome do tópico</Label>
              <Input
                id="topic-title"
                autoFocus
                required
                value={topicEditor?.title ?? ""}
                onChange={(event) =>
                  setTopicEditor((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTopicEditor(null)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar tópico</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
