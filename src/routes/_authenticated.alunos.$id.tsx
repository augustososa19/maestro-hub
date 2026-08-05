import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarPlus,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Save,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAddFinancialTransaction,
  useInvalidateAll,
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
  type Lesson,
  type LessonWithStudent,
  type Student,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const invalidate = useInvalidateAll();
  const { data: student, isLoading } = useStudent(id);
  const { data: lessons = [] } = useStudentLessons(id);
  const { data: reports = [] } = useStudentReports(id);
  const { data: materials = [] } = useMaterials(id);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    setNotes(student?.notes ?? "");
  }, [student?.notes]);

  const withStudent = (lesson: Lesson): LessonWithStudent => ({
    ...lesson,
    student: student
      ? {
          id: student.id,
          name: student.name,
          photo_url: student.photo_url,
          instrument: student.instrument,
        }
      : null,
  });

  const saveNotes = async () => {
    if (!student) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("students")
      .update({ notes: notes.trim() || null })
      .eq("id", student.id);
    setSavingNotes(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Notas do aluno atualizadas.");
    invalidate();
  };

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
          <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
            <WalletCards className="h-4 w-4" /> Cobrança
          </Button>
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
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge
                    value={lesson.status}
                    label={labelOf(LESSON_STATUS, lesson.status)}
                    className="shrink-0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shell.openReport(withStudent(lesson))}
                  >
                    <FileText className="h-4 w-4" /> Relatório
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="mt-3 space-y-2">
          {lessons.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  const pendingLesson =
                    lessons.find(
                      (lesson) => !reports.some((report) => report.lesson_id === lesson.id),
                    ) ?? lessons[0];
                  if (pendingLesson) shell.openReport(withStudent(pendingLesson));
                }}
              >
                <FileText className="h-4 w-4" /> Novo relatório
              </Button>
            </div>
          )}
          {reports.length === 0 && (
            <EmptyState
              illustration="check"
              title="Nenhum relatório salvo"
              description="Crie um relatório a partir de uma aula do histórico."
              action={
                lessons[0] ? (
                  <Button size="sm" onClick={() => shell.openReport(withStudent(lessons[0]!))}>
                    <FileText className="h-4 w-4" /> Criar relatório
                  </Button>
                ) : undefined
              }
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
                {(() => {
                  const lesson = lessons.find((item) => item.id === report.lesson_id);
                  return lesson ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shell.openReport(withStudent(lesson))}
                    >
                      <Pencil className="h-4 w-4" /> Editar relatório
                    </Button>
                  ) : null;
                })()}
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
          <div className="panel space-y-3 p-4">
            <div>
              <Label htmlFor="student-notes">Notas gerais do aluno</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Registre observações permanentes, objetivos e pontos de atenção.
              </p>
            </div>
            <Textarea
              id="student-notes"
              rows={7}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: objetivo atual, repertório em estudo, dificuldades e observações importantes..."
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={saveNotes}
                disabled={savingNotes || notes === (student.notes ?? "")}
              >
                {savingNotes ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar notas
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <StudentPaymentDialog student={student} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </div>
  );
}

function StudentPaymentDialog({
  student,
  open,
  onOpenChange,
}: {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addTransaction = useAddFinancialTransaction();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<"mensalidade" | "aula_avulsa" | "pacote" | "outros">(
    "mensalidade",
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "pix" | "dinheiro" | "cartao" | "transferencia"
  >("pix");

  useEffect(() => {
    if (!open) return;
    setDescription(`Mensalidade - ${student.instrument || "Aulas de música"}`);
    setAmount("");
    setDueDate(new Date().toISOString().slice(0, 10));
    setCategory("mensalidade");
    setPaymentMethod("pix");
  }, [open, student.instrument]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Informe uma descrição e um valor válido.");
      return;
    }

    addTransaction.mutate(
      {
        student_id: student.id,
        student_name: student.name,
        description: description.trim(),
        amount: value,
        type: "receita",
        category,
        status: "pendente",
        payment_method: paymentMethod,
        due_date: dueDate,
        paid_at: null,
      },
      {
        onSuccess: () => {
          toast.success("Cobrança lançada no financeiro.");
          onOpenChange(false);
        },
        onError: () => toast.error("Não foi possível lançar a cobrança."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar cobrança para {student.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="charge-description">Descrição</Label>
            <Input
              id="charge-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="charge-value">Valor (R$)</Label>
              <Input
                id="charge-value"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="300,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-due">Vencimento</Label>
              <Input
                id="charge-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="charge-category">Categoria</Label>
              <select
                id="charge-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as typeof category)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="mensalidade">Mensalidade</option>
                <option value="aula_avulsa">Aula avulsa</option>
                <option value="pacote">Pacote</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-payment">Forma prevista</Label>
              <select
                id="charge-payment"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={addTransaction.isPending}>
            {addTransaction.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <WalletCards className="h-4 w-4" />
            )}
            Lançar cobrança
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
