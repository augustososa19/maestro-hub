import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarPlus, Mail, Pencil, Phone } from "lucide-react";
import {
  useMaterials,
  useStudent,
  useStudentLessons,
  useStudentReports,
} from "@/hooks/useMusicData";
import { useShell } from "@/components/app/shell-context";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  LESSON_STATUS,
  LESSON_TYPES,
  STUDENT_STATUS,
  WEEKDAYS,
  formatBytes,
  initials,
  labelOf,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusBadge } from "@/components/app/primitives";

export const Route = createFileRoute("/_authenticated/alunos/$id")({
  head: () => ({
    meta: [
      { title: "Perfil do aluno · MusicCRM" },
      {
        name: "description",
        content: "Dados, histórico de aulas, relatórios e materiais do aluno.",
      },
      { property: "og:title", content: "Perfil do aluno · MusicCRM" },
      {
        property: "og:description",
        content: "Dados, histórico de aulas, relatórios e materiais do aluno.",
      },
    ],
  }),
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const shell = useShell();
  const { data: student, isLoading } = useStudent(id);
  const { data: lessons = [] } = useStudentLessons(id);
  const { data: reports = [] } = useStudentReports(id);
  const { data: materials = [] } = useMaterials(id);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!student) {
    return (
      <EmptyState
        illustration="search"
        title="Aluno não encontrado"
        description="O aluno pode ter sido removido."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/alunos">Voltar para alunos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <Link
        to="/alunos"
        className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Alunos
      </Link>

      <header className="panel grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-4 sm:flex sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0 ring-1 ring-border">
            <AvatarImage src={student.photo_url ?? undefined} alt={student.name} />
            <AvatarFallback>{initials(student.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{student.name}</h1>
              <StatusBadge value={student.status} label={labelOf(STUDENT_STATUS, student.status)} />
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {student.instrument}
              {student.goal ? ` · ${student.goal}` : ""}
            </p>
            {student.default_weekday !== null && (
              <div className="mt-2">
                <Badge variant="outline">
                  {WEEKDAYS[student.default_weekday]?.label} {student.default_time?.slice(0, 5)}
                </Badge>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => shell.openStudent(student)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button size="sm" onClick={() => shell.openLesson({ studentId: student.id })}>
            <CalendarPlus className="h-4 w-4" /> Agendar
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {student.whatsapp && (
          <a
            href={`https://wa.me/${student.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="panel panel-hover flex min-w-0 items-center gap-3 p-3.5 text-sm transition-colors hover:border-primary/25 hover:bg-accent/30"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Phone className="h-4 w-4" />
            </span>
            <span className="truncate font-medium">{student.whatsapp}</span>
          </a>
        )}
        {student.email && (
          <a
            href={`mailto:${student.email}`}
            className="panel panel-hover flex min-w-0 items-center gap-3 p-3.5 text-sm transition-colors hover:border-primary/25 hover:bg-accent/30"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Mail className="h-4 w-4" />
            </span>
            <span className="truncate font-medium">{student.email}</span>
          </a>
        )}
      </div>

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-3 space-y-2">
          {lessons.length === 0 && (
            <EmptyState
              illustration="calendar"
              title="Nenhuma aula registrada"
              description="As aulas deste aluno aparecerão aqui."
              className="py-8"
            />
          )}
          <div className="stagger">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="panel panel-hover mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-sm transition-colors hover:border-primary/25"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{formatDateTime(lesson.starts_at)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {labelOf(LESSON_TYPES, lesson.lesson_type)} · {lesson.duration_minutes} min
                  </p>
                </div>
                <StatusBadge
                  value={lesson.status}
                  label={labelOf(LESSON_STATUS, lesson.status)}
                  className="shrink-0"
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="mt-3 space-y-2">
          {reports.length === 0 && (
            <EmptyState
              illustration="check"
              title="Nenhum relatório salvo"
              description="Relatórios de aula aparecerão aqui."
              className="py-8"
            />
          )}
          <div className="stagger">
            {reports.map((report) => (
              <article
                key={report.id}
                className="panel panel-hover mb-2 space-y-2 p-4 text-sm transition-colors hover:border-primary/25"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {formatDate(report.created_at)}
                </p>
                {report.content && (
                  <p>
                    <span className="font-medium">Conteúdo: </span>
                    {report.content}
                  </p>
                )}
                {report.exercises && (
                  <p>
                    <span className="font-medium">Exercícios: </span>
                    {report.exercises}
                  </p>
                )}
                {report.notes && <p className="text-muted-foreground">{report.notes}</p>}
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="materiais" className="mt-3 space-y-2">
          {materials.length === 0 && (
            <EmptyState
              illustration="folder"
              title="Nenhum material vinculado"
              description="Envie materiais na Biblioteca e vincule a este aluno."
              className="py-8"
            />
          )}
          <div className="stagger">
            {materials.map((material) => (
              <div
                key={material.id}
                className="panel panel-hover mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-sm transition-colors hover:border-primary/25"
              >
                <span className="truncate font-medium">{material.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(material.size_bytes)}
                </span>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/biblioteca">Ir para a biblioteca</Link>
          </Button>
        </TabsContent>

        <TabsContent value="notas" className="mt-3">
          <div className="panel whitespace-pre-wrap p-4 text-sm">
            {student.notes || <span className="text-muted-foreground">Sem observações.</span>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
