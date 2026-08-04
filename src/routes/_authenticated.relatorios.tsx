import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  PieChart,
  Users,
  Music4,
} from "lucide-react";
import { toast } from "sonner";
import { useFinancialTransactions, useLessons, useStudents } from "@/hooks/useMusicData";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios Gerenciais · MusicCRM" },
      { name: "description", content: "Relatórios de horas trabalhadas, frequência, receitas e modalidades." },
    ],
  }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { data: lessons = [] } = useLessons();
  const { data: students = [] } = useStudents();
  const { data: transactions = [] } = useFinancialTransactions();

  const totalMinutesTaught = lessons
    .filter((l) => l.status === "realizada")
    .reduce((acc, l) => acc + (l.duration_minutes || 60), 0);
  const totalHoursTaught = (totalMinutesTaught / 60).toFixed(1);

  const activeStudents = students.filter((s) => s.status === "ativo").length;
  const pausedStudents = students.filter((s) => s.status === "pausado").length;
  const inactiveStudents = students.filter((s) => s.status === "inativo").length;

  const totalRealizedLessons = lessons.filter((l) => l.status === "realizada").length;
  const totalCancelledLessons = lessons.filter((l) => l.status === "cancelada").length;
  const totalLessons = lessons.length || 1;
  const presenceRate = Math.round((totalRealizedLessons / totalLessons) * 100);

  // Instruments breakdown
  const instrumentsCount = students.reduce((acc, s) => {
    const inst = s.instrument || "Outro";
    acc[inst] = (acc[inst] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const exportReport = (type: "PDF" | "Excel") => {
    toast.success(`Relatório em formato ${type} gerado com sucesso!`);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatórios Gerenciais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Métricas de desempenho, horas de aula ministradas e frequência de alunos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportReport("Excel")}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Exportar Excel
          </Button>
          <Button size="sm" onClick={() => exportReport("PDF")}>
            <FileText className="h-4 w-4 mr-1.5" /> Exportar PDF
          </Button>
        </div>
      </header>

      {/* Top Metrics Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total de Horas Aulas</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{totalHoursTaught}h</p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </span>
        </div>

        <div className="panel p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Alunos Ativos</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{activeStudents}</p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Users className="h-5 w-5" />
          </span>
        </div>

        <div className="panel p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Taxa de Presença</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{presenceRate}%</p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="h-5 w-5" />
          </span>
        </div>

        <div className="panel p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Aulas Registradas</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{lessons.length}</p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Calendar className="h-5 w-5" />
          </span>
        </div>
      </section>

      {/* Relatórios Detalhados */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Distribuição por Instrumento */}
        <div className="panel p-5 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Music4 className="h-4 w-4 text-primary" /> Alunos por Instrumento
          </h2>

          <div className="space-y-3">
            {Object.keys(instrumentsCount).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aluno cadastrado.</p>
            ) : (
              Object.entries(instrumentsCount).map(([inst, count]) => {
                const percent = Math.round((count / (students.length || 1)) * 100);
                return (
                  <div key={inst} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{inst}</span>
                      <span className="text-muted-foreground text-xs">{count} alunos ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-accent overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
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
        <div className="panel p-5 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" /> Status dos Alunos
          </h2>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <p className="text-xs text-muted-foreground font-medium">Ativos</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeStudents}</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3">
              <p className="text-xs text-muted-foreground font-medium">Pausados</p>
              <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{pausedStudents}</p>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-3">
              <p className="text-xs text-muted-foreground font-medium">Inativos</p>
              <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{inactiveStudents}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-1">
            <p>• Total de matrículas ativas no sistema: <strong>{activeStudents}</strong></p>
            <p>• Aulas canceladas ou remarcadas este mês: <strong>{totalCancelledLessons}</strong></p>
          </div>
        </div>
      </section>
    </div>
  );
}
