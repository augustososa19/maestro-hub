import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { useLessons, useStudents } from "@/hooks/useMusicData";
import { useShell } from "@/components/app/shell-context";
import { STUDENT_STATUS, initials, labelOf, WEEKDAYS } from "@/lib/domain";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, EmptyState, FilterPill, StatusBadge } from "@/components/app/primitives";

export const Route = createFileRoute("/_authenticated/alunos/")({
  head: () => ({
    meta: [
      { title: "Alunos · MusicCRM" },
      {
        name: "description",
        content: "Cadastro completo dos seus alunos, com busca e filtros por situação.",
      },
      { property: "og:title", content: "Alunos · MusicCRM" },
      {
        property: "og:description",
        content: "Cadastro completo dos seus alunos, com busca e filtros.",
      },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const shell = useShell();
  const { data: students = [], isLoading } = useStudents();
  const { data: lessons = [] } = useLessons();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("todos");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.instrument ?? "").toLowerCase().includes(q) ||
        (s.whatsapp ?? "").includes(q);
      const matchStatus = status === "todos" || s.status === status;
      return matchQuery && matchStatus;
    });
  }, [students, query, status]);

  const nextLessonOf = (studentId: string) => {
    const now = Date.now();
    return lessons
      .filter(
        (l) =>
          (l.student_id === studentId ||
            l.participants.some((participant) => participant.student_id === studentId)) &&
          new Date(l.starts_at).getTime() >= now &&
          l.status !== "cancelada",
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  };

  const noStudents = students.length === 0;

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader
        title="Alunos"
        description={`${students.length} cadastrado${students.length === 1 ? "" : "s"}`}
        actions={
          <Button size="sm" onClick={() => shell.openStudent()}>
            <UserPlus className="h-4 w-4" /> Novo aluno
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, instrumento ou telefone"
            className="pl-9"
            aria-label="Buscar alunos"
          />
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filtrar por situação"
        >
          <FilterPill
            label="Todos"
            active={status === "todos"}
            onClick={() => setStatus("todos")}
          />
          {STUDENT_STATUS.map((s) => (
            <FilterPill
              key={s.value}
              label={s.label}
              active={status === s.value}
              onClick={() => setStatus(s.value)}
            />
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : noStudents ? (
        <EmptyState
          illustration="music"
          title="Comece adicionando seu primeiro aluno"
          description="Cadastre alunos para organizar aulas, agenda, materiais e acompanhar a evolução de cada um."
          action={
            <Button size="sm" onClick={() => shell.openStudent()}>
              <UserPlus className="h-4 w-4" /> Cadastrar aluno
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration="search"
          title="Nenhum aluno encontrado"
          description="Ajuste a busca ou os filtros para encontrar o que procura."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("todos");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((student) => {
            const next = nextLessonOf(student.id);
            return (
              <li key={student.id} className="panel-hover">
                <Link
                  to="/alunos/$id"
                  params={{ id: student.id }}
                  className="panel group block h-full p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0 ring-1 ring-border">
                      <AvatarImage src={student.photo_url ?? undefined} alt={student.name} />
                      <AvatarFallback>{initials(student.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">{student.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.instrument || "Sem instrumento"}
                      </p>
                    </div>
                    <StatusBadge
                      value={student.status}
                      label={labelOf(STUDENT_STATUS, student.status)}
                      className="ml-auto shrink-0"
                    />
                  </div>
                  <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    <p className="truncate">
                      <span className="font-medium text-foreground/80">Aula habitual: </span>
                      {student.default_weekday === null
                        ? "não definida"
                        : `${WEEKDAYS[student.default_weekday]?.label} · ${student.default_time?.slice(0, 5) ?? ""}`}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-foreground/80">Próxima aula: </span>
                      {next ? formatDateTime(next.starts_at) : "sem agendamento"}
                    </p>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Ver perfil <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
