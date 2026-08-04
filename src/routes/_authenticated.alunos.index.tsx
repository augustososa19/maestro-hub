import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, UserPlus } from "lucide-react";
import { useLessons, useStudents } from "@/hooks/useMusicData";
import { useShell } from "@/components/app/shell-context";
import { STUDENT_STATUS, initials, labelOf, WEEKDAYS } from "@/lib/domain";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alunos/")({
  head: () => ({
    meta: [
      { title: "Alunos · MusicCRM" },
      { name: "description", content: "Cadastro completo dos seus alunos, com busca e filtros por situação." },
      { property: "og:title", content: "Alunos · MusicCRM" },
      { property: "og:description", content: "Cadastro completo dos seus alunos, com busca e filtros." },
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
      .filter((l) => l.student_id === studentId && new Date(l.starts_at).getTime() >= now && l.status !== "cancelada")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Alunos</h1>
          <p className="mt-1 text-sm text-muted-foreground">{students.length} cadastrados</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => shell.openStudent()}>
          <UserPlus className="h-4 w-4" /> Novo aluno
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, instrumento ou telefone"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5">
          {[{ value: "todos", label: "Todos" }, ...STUDENT_STATUS].map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                status === s.value ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => shell.openStudent()}>
            <UserPlus className="h-4 w-4" /> Cadastrar aluno
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((student) => {
            const next = nextLessonOf(student.id);
            return (
              <li key={student.id}>
                <Link
                  to="/alunos/$id"
                  params={{ id: student.id }}
                  className="panel block h-full p-4 transition-colors hover:bg-accent/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={student.photo_url ?? undefined} alt={student.name} />
                      <AvatarFallback>{initials(student.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{student.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{student.instrument}</p>
                    </div>
                    <Badge
                      variant={student.status === "ativo" ? "secondary" : "outline"}
                      className="ml-auto shrink-0"
                    >
                      {labelOf(STUDENT_STATUS, student.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p className="truncate">
                      Aula habitual:{" "}
                      {student.default_weekday === null
                        ? "não definida"
                        : `${WEEKDAYS[student.default_weekday]?.label} · ${student.default_time?.slice(0, 5) ?? ""}`}
                    </p>
                    <p className="truncate">
                      Próxima aula: {next ? formatDateTime(next.starts_at) : "sem agendamento"}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
