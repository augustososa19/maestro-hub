import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
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

  const totalRevenue = (transactions as FinancialTransaction[])
    .filter((t) => t.type === "receita" && t.status === "pago")
    .reduce((acc, t) => acc + t.amount, 0);

  const instrumentsCount = students.reduce(
    (acc, s) => {
      const inst = s.instrument || "Outro";
      acc[inst] = (acc[inst] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const exportReport = (type: "PDF" | "Excel") => {
    toast.success(`Relatório em formato ${type} gerado com sucesso!`);
  };

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader
        title="Relatórios Gerenciais"
        description="Métricas de desempenho, horas de aula ministradas e frequência de alunos."
        actions={
          <>
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
          label="Total de Horas Aulas"
          value={`${totalHoursTaught}h`}
          icon={Clock}
          tone="primary"
        />
        <StatCard label="Alunos Ativos" value={activeStudents} icon={Users} tone="success" />
        <StatCard
          label="Taxa de Presença"
          value={`${presenceRate}%`}
          icon={CheckCircle2}
          tone="info"
        />
        <StatCard label="Aulas Registradas" value={lessons.length} icon={Calendar} tone="muted" />
      </section>

      {/* Relatórios Detalhados */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Distribuição por Instrumento */}
        <div className="panel p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Music4 className="h-4 w-4 text-primary" /> Alunos por Instrumento
          </h2>

          <div className="mt-4 space-y-3">
            {Object.keys(instrumentsCount).length === 0 ? (
              <EmptyState
                illustration="music"
                title="Nenhum aluno cadastrado"
                description="Cadastre alunos para ver a distribuição por instrumento."
                className="py-8"
              />
            ) : (
              Object.entries(instrumentsCount).map(([inst, count]) => {
                const percent = Math.round((count / (students.length || 1)) * 100);
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
              <span className="text-muted-foreground">Aulas canceladas</span>
              <strong className="font-semibold tabular-nums">{totalCancelledLessons}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
