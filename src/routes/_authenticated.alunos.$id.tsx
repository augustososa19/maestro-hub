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
  useStudentPrograms,
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
  type LessonWithStudent,
  type Student,
  type StudentProgram,
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
  const { data: programs = [] } = useStudentPrograms(id);
  const { data: reports = [] } = useStudentReports(id);
  const { data: materials = [] } = useMaterials(id);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    setNotes(student?.notes ?? "");
  }, [student?.notes]);

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

      <header className="panel flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0 ring-1 ring-border sm:h-16 sm:w-16">
            <AvatarImage src={student.photo_url ?? undefined} alt={student.name} />
            <AvatarFallback>{initials(student.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-xl font-semibold leading-tight tracking-tight">
                {student.name}
              </h1>
              <StatusBadge value={student.status} label={labelOf(STUDENT_STATUS, student.status)} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {(programs.length > 0
                ? programs
                : [{ id: "fallback", instrument: student.instrument, is_primary: true }]
              ).map((program) => (
                <Badge
                  key={program.id}
                  variant={program.is_primary ? "default" : "outline"}
                  className="text-xs"
                >
                  {program.instrument}
                  {program.is_primary ? " · Principal" : ""}
                </Badge>
              ))}
            </div>
            {student.goal && (
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{student.goal}</p>
            )}
            {student.default_weekday !== null && (
              <div className="mt-2">
                <Badge variant="outline">
                  {WEEKDAYS[student.default_weekday]?.label} {student.default_time?.slice(0, 5)}
                </Badge>
              </div>
            )}
          </div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 md:w-auto md:shrink-0">
          <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
            <WalletCards className="h-4 w-4" />
            <span className="hidden sm:inline">Cobrança</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => shell.openStudent(student)}>
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
          <Button size="sm" onClick={() => shell.openLesson({ studentId: student.id })}>
            <CalendarPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Agendar</span>
          </Button>
        </div>
      </header>

      {programs.length > 0 && (
        <section className="panel p-4" aria-labelledby="student-programs-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="student-programs-title" className="text-sm font-semibold">
              Planos
            </h2>
            <span className="text-xs text-muted-foreground">
              {programs.length} {programs.length === 1 ? "instrumento" : "instrumentos"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <div key={program.id} className="rounded-lg border border-border/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{program.instrument}</span>
                  {program.is_primary && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Principal
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {billingLabel(program.billing_type)}
                  {program.amount !== null ? ` · ${formatMoney(program.amount)}` : ""}
                  {program.billing_type === "mensalidade" && program.due_day
                    ? ` · vence dia ${program.due_day}`
                    : ""}
                  {program.billing_type === "pacote" && program.package_lessons
                    ? ` · ${program.package_lessons} aulas`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {student.whatsapp && (
          <a
            href={`https://wa.me/${student.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="panel panel-hover flex min-w-0 items-center gap-3 p-3.5 text-sm transition-colors hover:border-primary/25 hover:bg-accent/30 sm:only:col-span-2"
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
            className="panel panel-hover flex min-w-0 items-center gap-3 p-3.5 text-sm transition-colors hover:border-primary/25 hover:bg-accent/30 sm:only:col-span-2"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Mail className="h-4 w-4" />
            </span>
            <span className="truncate font-medium">{student.email}</span>
          </a>
        )}
      </div>

      <Tabs defaultValue="historico">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="min-w-max">
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
          </TabsList>
        </div>

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
                className="panel panel-hover mb-2 flex flex-col gap-3 p-3 text-sm transition-colors hover:border-primary/25 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{formatDateTime(lesson.starts_at)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {labelOf(LESSON_TYPES, lesson.lesson_type)} · {lesson.duration_minutes} min
                  </p>
                  {lesson.participants.length > 1 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="mr-1.5 align-middle text-[10px]">
                        Coletiva
                      </Badge>
                      {participantSummary(lesson)}
                    </p>
                  )}
                </div>
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                  <StatusBadge
                    value={lesson.status}
                    label={labelOf(LESSON_STATUS, lesson.status)}
                    className="shrink-0"
                  />
                  <Button variant="outline" size="sm" onClick={() => shell.openReport(lesson)}>
                    <FileText className="h-4 w-4" /> Relatório
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="mt-3 space-y-2">
          {lessons.length > 0 && reports.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  const pendingLesson =
                    lessons.find(
                      (lesson) => !reports.some((report) => report.lesson_id === lesson.id),
                    ) ?? lessons[0];
                  if (pendingLesson) shell.openReport(pendingLesson);
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
                  <Button size="sm" onClick={() => shell.openReport(lessons[0]!)}>
                    <FileText className="h-4 w-4" /> Criar relatório
                  </Button>
                ) : undefined
              }
              className="py-8"
            />
          )}
          <div className="stagger max-w-3xl">
            {reports.map((report) => (
              <article
                key={report.id}
                className="panel panel-hover mb-2 space-y-2 p-4 text-sm transition-colors hover:border-primary/25"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={report.scope === "geral" ? "default" : "secondary"}>
                    {report.scope === "geral" ? "Relatório geral" : "Avaliação individual"}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDate(report.created_at)}
                  </span>
                </div>
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
                    <Button variant="outline" size="sm" onClick={() => shell.openReport(lesson)}>
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
          <div className="panel max-w-3xl space-y-3 p-4 sm:p-5">
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

      <StudentPaymentDialog
        student={student}
        programs={programs}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </div>
  );
}

function billingLabel(billingType: string) {
  if (billingType === "aula_avulsa") return "Aula avulsa";
  if (billingType === "pacote") return "Pacote";
  return "Mensalidade";
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function participantSummary(lesson: LessonWithStudent) {
  const names = lesson.participants.map((participant) => participant.student.name.split(" ")[0]);
  const summary = names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} e mais`;
  return `${names.length} participantes: ${summary}`;
}

function categoryForProgram(program?: StudentProgram) {
  if (program?.billing_type === "aula_avulsa") return "aula_avulsa" as const;
  if (program?.billing_type === "pacote") return "pacote" as const;
  return "mensalidade" as const;
}

function chargeDescription(program: StudentProgram) {
  if (program.billing_type === "pacote") {
    const quantity = program.package_lessons ? ` de ${program.package_lessons} aulas` : "";
    return `Pacote${quantity} - ${program.instrument}`;
  }
  if (program.billing_type === "aula_avulsa") return `Aula avulsa - ${program.instrument}`;
  return `Mensalidade - ${program.instrument}`;
}

function dueDateForCurrentMonth(dueDay?: number | null) {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = Math.min(Math.max(dueDay ?? now.getDate(), 1), lastDay);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function StudentPaymentDialog({
  student,
  programs,
  open,
  onOpenChange,
}: {
  student: Student;
  programs: StudentProgram[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addTransaction = useAddFinancialTransaction();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [programId, setProgramId] = useState("");
  const [category, setCategory] = useState<"mensalidade" | "aula_avulsa" | "pacote" | "outros">(
    "mensalidade",
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "pix" | "dinheiro" | "cartao" | "transferencia"
  >("pix");

  useEffect(() => {
    if (!open) return;
    const initialProgram = programs.find((program) => program.is_primary) ?? programs[0];
    setProgramId(initialProgram?.id ?? "");
    setDescription(
      initialProgram
        ? chargeDescription(initialProgram)
        : `Mensalidade - ${student.instrument || "Aulas de música"}`,
    );
    setAmount(
      initialProgram?.amount === null || !initialProgram ? "" : String(initialProgram.amount),
    );
    setDueDate(dueDateForCurrentMonth(initialProgram?.due_day));
    setCategory(categoryForProgram(initialProgram));
    setPaymentMethod("pix");
  }, [open, programs, student.instrument]);

  const selectProgram = (nextProgramId: string) => {
    setProgramId(nextProgramId);
    const program = programs.find((item) => item.id === nextProgramId);
    if (!program) return;
    setDescription(chargeDescription(program));
    setAmount(program.amount === null ? "" : String(program.amount));
    setCategory(categoryForProgram(program));
    setDueDate(dueDateForCurrentMonth(program.due_day));
  };

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
        competence_date: `${dueDate.slice(0, 7)}-01`,
        student_program_id: programId || null,
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar cobrança para {student.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {programs.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="charge-program">Instrumento / plano</Label>
              <select
                id="charge-program"
                value={programId}
                onChange={(event) => selectProgram(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.instrument} · {billingLabel(program.billing_type)}
                    {program.is_primary ? " (principal)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="charge-description">Descrição</Label>
            <Input
              id="charge-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="charge-category">Categoria</Label>
              <select
                id="charge-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as typeof category)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
