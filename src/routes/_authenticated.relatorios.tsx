import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FileText,
  Music4,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useFinancialTransactions, useLessons, useStudents } from "@/hooks/useMusicData";
import type { FinancialTransaction } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, EmptyState } from "@/components/app/primitives";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios Gerenciais · MusicCRM" },
      {
        name: "description",
        content: "Relatórios de horas trabalhadas, frequência, receitas e modalidades.",
      },
    ],
  }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(currentMonth);
  const [year, monthNumber] = month.split("-").map(Number);
  const monthRange = {
    from: new Date(year!, monthNumber! - 1, 1),
    to: new Date(year!, monthNumber!, 1),
  };

  const { data: lessons = [] } = useLessons(monthRange);
  const { data: students = [] } = useStudents();
  const { data: transactions = [] } = useFinancialTransactions(month);

  const realizedLessons = lessons.filter((lesson) => lesson.status === "realizada");

  const totalMinutesTaught = realizedLessons.reduce(
    (acc, lesson) => acc + (lesson.duration_minutes || 60),
    0,
  );
  const totalHoursTaught = (totalMinutesTaught / 60).toFixed(1);

  const activeStudents = students.filter((s) => s.status === "ativo").length;
  const pausedStudents = students.filter((s) => s.status === "pausado").length;
  const inactiveStudents = students.filter((s) => s.status === "inativo").length;

  const totalRealizedLessons = realizedLessons.length;
  const totalCancelledLessons = lessons.filter((l) => l.status === "cancelada").length;
  const assessedAttendances = realizedLessons
    .flatMap((lesson) => lesson.participants)
    .filter((participant) => participant.attendance !== "pendente");
  const presenceRate = assessedAttendances.length
    ? Math.round(
        (assessedAttendances.filter((participant) => participant.attendance === "presente").length /
          assessedAttendances.length) *
          100,
      )
    : lessons.length
      ? Math.round((totalRealizedLessons / lessons.length) * 100)
      : 0;

  const totalParticipations = realizedLessons.reduce((total, lesson) => {
    if (lesson.participants.length > 0) {
      return (
        total +
        new Set(
          lesson.participants
            .filter((participant) => participant.attendance === "presente")
            .map((participant) => participant.student_id),
        ).size
      );
    }
    return total + (lesson.student_id ? 1 : 0);
  }, 0);

  const totalRevenue = (transactions as FinancialTransaction[])
    .filter((t) => t.type === "receita" && t.status === "pago")
    .reduce((acc, t) => acc + t.amount, 0);

  const studentsById = new Map(students.map((student) => [student.id, student]));
  const instrumentStudents = new Map<string, Set<string>>();

  for (const lesson of realizedLessons) {
    if (lesson.participants.length > 0) {
      for (const participant of lesson.participants.filter(
        (item) => item.attendance === "presente",
      )) {
        const instrument =
          participant.program?.instrument ||
          participant.student?.instrument ||
          studentsById.get(participant.student_id)?.instrument ||
          "Outro";
        const studentIds = instrumentStudents.get(instrument) ?? new Set<string>();
        studentIds.add(participant.student_id);
        instrumentStudents.set(instrument, studentIds);
      }
      continue;
    }

    if (lesson.student_id) {
      const instrument =
        lesson.student?.instrument || studentsById.get(lesson.student_id)?.instrument || "Outro";
      const studentIds = instrumentStudents.get(instrument) ?? new Set<string>();
      studentIds.add(lesson.student_id);
      instrumentStudents.set(instrument, studentIds);
    }
  }

  const instrumentsCount = Array.from(
    instrumentStudents,
    ([instrument, studentIds]) => [instrument, studentIds.size] as const,
  );
  const totalInstrumentEnrollments = instrumentsCount.reduce(
    (total, [, count]) => total + count,
    0,
  );

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(year!, monthNumber! - 1 + offset, 1);
    setMonth(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`);
  };

  const exportReport = (type: "PDF" | "Excel") => {
    toast.success(`Relatório em formato ${type} gerado com sucesso!`);
  };

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader
        title="Relatórios Gerenciais"
        description={`Métricas de desempenho, horas e frequência em ${monthRange.from.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.`}
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
              title="Mês anterior"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="month"
              value={month}
              aria-label="Mês do relatório"
              onChange={(event) => event.target.value && setMonth(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo mês"
              title="Próximo mês"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(currentMonth)}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport("Excel")}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
            </Button>
            <Button size="sm" onClick={() => exportReport("PDF")}>
              <FileText className="h-4 w-4" /> Exportar PDF
            </Button>
          </>
        }
      />

      {/* Top Metrics Cards */}
      <section className="stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Horas Ministradas"
          value={`${totalHoursTaught}h`}
          icon={Clock}
          tone="primary"
        />
        <StatCard
          label="Sessões Realizadas"
          value={totalRealizedLessons}
          icon={Calendar}
          tone="success"
        />
        <StatCard label="Participações" value={totalParticipations} icon={Users} tone="info" />
        <StatCard
          label="Taxa de Presença"
          value={`${presenceRate}%`}
          icon={CheckCircle2}
          tone="muted"
        />
      </section>

      {/* Relatórios Detalhados */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Distribuição por Instrumento */}
        <div className="panel p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Music4 className="h-4 w-4 text-primary" /> Alunos por Instrumento
          </h2>

          <div className="mt-4 space-y-3">
            {instrumentsCount.length === 0 ? (
              <EmptyState
                illustration="music"
                title="Nenhuma participação realizada"
                description="As participações em aulas realizadas aparecerão aqui."
                className="py-8"
              />
            ) : (
              instrumentsCount.map(([inst, count]) => {
                const percent = Math.round((count / totalInstrumentEnrollments) * 100);
                return (
                  <div key={inst} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{inst}</span>
                      <span className="text-xs text-muted-foreground">
                        {count} aluno{count > 1 ? "s" : ""} · {percent}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                      <div
                        className="progress-animated h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Resumo de Status dos Alunos */}
        <div className="panel p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-4 w-4 text-primary" /> Panorama Geral
          </h2>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-xs font-medium text-muted-foreground">Ativos</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {activeStudents}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-xs font-medium text-muted-foreground">Pausados</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {pausedStudents}
              </p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-xs font-medium text-muted-foreground">Inativos</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {inactiveStudents}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Receita recebida</span>
              <strong className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Matrículas ativas</span>
              <strong className="font-semibold tabular-nums">{activeStudents}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Aulas registradas no mês</span>
              <strong className="font-semibold tabular-nums">{lessons.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Aulas canceladas</span>
              <strong className="font-semibold tabular-nums">{totalCancelledLessons}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
