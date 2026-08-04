import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";
import { DEFAULT_CURRICULUM_MODULES } from "@/lib/domain";
import { useStudentReports, useStudents } from "@/hooks/useMusicData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/evolucao")({
  head: () => ({
    meta: [
      { title: "Evolução & Cronogramas · MusicCRM" },
      { name: "description", content: "Cronograma de ensino, linha do tempo de evolução e nível do aluno." },
    ],
  }),
  component: EvolucaoPage,
});

function EvolucaoPage() {
  const { data: students = [] } = useStudents();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id ?? "");
  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  const { data: reports = [] } = useStudentReports(selectedStudent?.id ?? "");
  const [modules, setModules] = useState(DEFAULT_CURRICULUM_MODULES);

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

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evolução & Cronograma</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe o desenvolvimento pedagógico e o progresso dos alunos por módulo.
          </p>
        </div>

        {/* Seleção do Aluno */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Aluno:</span>
          <select
            value={selectedStudent?.id ?? ""}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.instrument})
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Cartão de Gamificação do Aluno */}
      {selectedStudent && (
        <section className="panel p-5 grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={selectedStudent.photo_url ?? undefined} alt={selectedStudent.name} />
              <AvatarFallback className="text-lg">{selectedStudent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{selectedStudent.name}</h2>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Nível {Math.floor(progressPercent / 20) + 1}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedStudent.instrument} · {selectedStudent.goal || "Desenvolvimento Geral"}
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-muted-foreground">Progresso do Curso</span>
              <span className="font-semibold tabular-nums text-primary">{progressPercent}% Concluído</span>
            </div>
            <Progress value={progressPercent} className="h-2.5" />
            <p className="text-xs text-muted-foreground">
              {completedTopics} de {totalTopics} tópicos do cronograma concluídos
            </p>
          </div>
        </section>
      )}

      {/* Grade com Cronograma de Módulos e Linha do Tempo */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Módulos de Ensino */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Módulos de Aprendizado
          </h2>

          <div className="space-y-4">
            {modules.map((mod) => (
              <div key={mod.id} className="panel p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{mod.title}</h3>
                  <Badge variant="outline" className="text-xs">{mod.level}</Badge>
                </div>

                <ul className="space-y-2">
                  {mod.topics.map((t) => (
                    <li
                      key={t.id}
                      onClick={() => toggleTopic(mod.id, t.id)}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${
                          t.completed ? "text-emerald-500 fill-emerald-500/20" : "text-muted-foreground/40"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          t.completed ? "line-through text-muted-foreground" : "text-foreground font-medium"
                        }`}
                      >
                        {t.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Linha do Tempo de Relatórios de Aula */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Histórico de Aulas (Timeline)
          </h2>

          {reports.length === 0 ? (
            <div className="panel p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhum relatório de aula registrado ainda para {selectedStudent?.name ?? "este aluno"}.
              </p>
              <p className="text-xs text-muted-foreground">
                Ao finalizar uma aula na Agenda, você pode registrar observações pedagógicas que aparecerão nesta timeline.
              </p>
            </div>
          ) : (
            <div className="relative border-l border-border ml-3 space-y-6 pl-5">
              {reports.map((r) => (
                <div key={r.id} className="relative group">
                  <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background" />
                  <div className="panel p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {r.content && <p className="text-sm font-medium">{r.content}</p>}
                    {r.exercises && (
                      <div className="rounded bg-accent/40 p-2 text-xs text-muted-foreground">
                        <strong className="text-foreground">Exercícios:</strong> {r.exercises}
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
