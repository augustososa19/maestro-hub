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

export const Route = createFileRoute("/_authenticated/alunos/$id")({
  head: () => ({
    meta: [
      { title: "Perfil do aluno · MusicCRM" },
      { name: "description", content: "Dados, histórico de aulas, relatórios e materiais do aluno." },
      { property: "og:title", content: "Perfil do aluno · MusicCRM" },
      { property: "og:description", content: "Dados, histórico de aulas, relatórios e materiais do aluno." },
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
      <div className="panel p-10 text-center">
        <p className="text-sm text-muted-foreground">Aluno não encontrado.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/alunos">Voltar para alunos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <Link to="/alunos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Alunos
      </Link>

      <header className="panel grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-5 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarImage src={student.photo_url ?? undefined} alt={student.name} />
            <AvatarFallback>{initials(student.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{student.name}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {student.instrument}
              {student.goal ? ` · ${student.goal}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{labelOf(STUDENT_STATUS, student.status)}</Badge>
              {student.default_weekday !== null && (
                <Badge variant="outline">
                  {WEEKDAYS[student.default_weekday]?.label} {student.default_time?.slice(0, 5)}
                </Badge>
              )}
            </div>
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
            className="panel flex min-w-0 items-center gap-3 p-4 text-sm hover:bg-accent/40"
          >
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{student.whatsapp}</span>
          </a>
        )}
        {student.email && (
          <a
            href={`mailto:${student.email}`}
            className="panel flex min-w-0 items-center gap-3 p-4 text-sm hover:bg-accent/40"
          >
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{student.email}</span>
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

        <TabsContent value="historico" className="mt-4 space-y-2">
          {lessons.length === 0 && <EmptyPanel text="Nenhuma aula registrada ainda." />}
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{formatDateTime(lesson.starts_at)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {labelOf(LESSON_TYPES, lesson.lesson_type)} · {lesson.duration_minutes} min
                </p>
              </div>
              <Badge variant={lesson.status === "realizada" ? "secondary" : "outline"} className="shrink-0">
                {labelOf(LESSON_STATUS, lesson.status)}
              </Badge>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="relatorios" className="mt-4 space-y-2">
          {reports.length === 0 && <EmptyPanel text="Nenhum relatório salvo." />}
          {reports.map((report) => (
            <article key={report.id} className="panel space-y-2 p-4 text-sm">
              <p className="text-xs text-muted-foreground">{formatDate(report.created_at)}</p>
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
        </TabsContent>

        <TabsContent value="materiais" className="mt-4 space-y-2">
          {materials.length === 0 && <EmptyPanel text="Nenhum material vinculado a este aluno." />}
          {materials.map((material) => (
            <div
              key={material.id}
              className="panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-sm"
            >
              <span className="truncate">{material.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(material.size_bytes)}</span>
            </div>
          ))}
          <Button variant="outline" size="sm" asChild>
            <Link to="/biblioteca">Ir para a biblioteca</Link>
          </Button>
        </TabsContent>

        <TabsContent value="notas" className="mt-4">
          <div className="panel whitespace-pre-wrap p-4 text-sm">
            {student.notes || <span className="text-muted-foreground">Sem observações.</span>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
