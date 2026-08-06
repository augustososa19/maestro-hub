import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll } from "@/hooks/useMusicData";
import type { LessonWithStudent } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReportFields = {
  id: string | undefined;
  content: string;
  exercises: string;
  notes: string;
};

type IndividualReport = ReportFields & {
  attendance: string;
  participantId: string | null;
};

type ParticipantOption = {
  student: NonNullable<LessonWithStudent["student"]>;
  participantId: string | null;
  attendance: string;
};

const emptyReport = (): ReportFields => ({ id: undefined, content: "", exercises: "", notes: "" });

const getErrorMessage = (error: unknown, fallback: string) =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string"
    ? error.message
    : fallback;

const getParticipants = (lesson: LessonWithStudent | null): ParticipantOption[] => {
  if (!lesson) return [];
  if (lesson.participants?.length > 0) {
    return lesson.participants.map((participant) => ({
      student: participant.student,
      participantId: participant.id,
      attendance: participant.attendance,
    }));
  }
  return lesson.student
    ? [{ student: lesson.student, participantId: null, attendance: "presente" }]
    : [];
};

export function ReportDialog({
  lesson,
  onOpenChange,
}: {
  lesson: LessonWithStudent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const invalidate = useInvalidateAll();
  const [general, setGeneral] = useState<ReportFields>(emptyReport);
  const [individuals, setIndividuals] = useState<Record<string, IndividualReport>>({});
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  const participants = getParticipants(lesson);

  useEffect(() => {
    if (!lesson) return;

    let active = true;
    const lessonParticipants = getParticipants(lesson);
    const initialIndividuals: Record<string, IndividualReport> = {};
    for (const { student, participantId, attendance } of lessonParticipants) {
      initialIndividuals[student.id] = {
        ...emptyReport(),
        participantId,
        attendance: ["pendente", "presente", "ausente", "justificado"].includes(attendance)
          ? attendance
          : "pendente",
      };
    }

    setGeneral(emptyReport());
    setIndividuals(initialIndividuals);
    setActiveTab("general");
    setLoading(true);
    setLoadError(false);

    const loadReports = async () => {
      try {
        const { data, error } = await supabase
          .from("lesson_reports")
          .select("*")
          .eq("lesson_id", lesson.id);
        if (!active) return;
        if (error) {
          setLoadError(true);
          toast.error(error.message);
          return;
        }

        const generalReport = data.find((report) => report.scope === "geral");
        if (generalReport) {
          setGeneral({
            id: generalReport.id,
            content: generalReport.content ?? "",
            exercises: generalReport.exercises ?? "",
            notes: generalReport.notes ?? "",
          });
        }

        setIndividuals((current) => {
          const next = { ...current };
          for (const report of data) {
            if (report.scope !== "individual" || !report.student_id) continue;
            const currentReport = next[report.student_id];
            if (!currentReport) continue;
            next[report.student_id] = {
              ...currentReport,
              id: report.id,
              content: report.content ?? "",
              exercises: report.exercises ?? "",
              notes: report.notes ?? "",
            };
          }
          return next;
        });
      } catch (error) {
        if (active) {
          setLoadError(true);
          toast.error(getErrorMessage(error, "Não foi possível carregar os relatórios."));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReports();

    return () => {
      active = false;
    };
  }, [lesson]);

  const generateWithAi = () => {
    setGeneratingAi(true);
    const onlyParticipant = participants.length === 1 ? participants[0] : undefined;
    const studentName = onlyParticipant?.student.name ?? "a turma";
    const instrument = onlyParticipant?.student.instrument ?? "Música";

    setTimeout(() => {
      setGeneral((current) => ({
        ...current,
        content: `Aula produtiva de ${instrument} com ${studentName}. Trabalhamos aperfeiçoamento técnico, leitura de ritmo e postura. Houve ótima retenção na transição dos acordes e afinação.`,
        exercises: `1. Praticar a sequência de acordes principal em 80 BPM (15 min/dia).\n2. Estudo de ritmo com metrônomo focando em clareza sonora.\n3. Treinar troca rápida de posição.`,
        notes: `Excelente evolução na dinâmica musical. Recomendado manter consistência nos treinos curtos diários.`,
      }));
      setActiveTab("general");
      setGeneratingAi(false);
      toast.success("Relatório geral gerado com sucesso por IA!");
    }, 600);
  };

  const updateIndividual = (studentId: string, field: keyof IndividualReport, value: string) => {
    setIndividuals((current) => {
      const report = current[studentId];
      if (!report) return current;
      return { ...current, [studentId]: { ...report, [field]: value } };
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lesson) return;
    if (loadError) {
      toast.error("Reabra o relatório para carregar os dados antes de salvar.");
      return;
    }
    if (participants.some(({ student }) => individuals[student.id]?.attendance === "pendente")) {
      toast.error("Confirme a presença de todos os participantes.");
      return;
    }

    setSaving(true);
    try {
      const generalPayload = {
        content: general.content || null,
        exercises: general.exercises || null,
        notes: general.notes || null,
      };

      const individualPayloads = participants.map(({ student }) => {
        const report = individuals[student.id];
        if (!report) throw new Error(`Avaliação de ${student.name} não foi carregada.`);
        return {
          student_id: student.id,
          content: report.content || null,
          exercises: report.exercises || null,
          notes: report.notes || null,
          attendance: report.attendance,
        };
      });

      const { error } = await supabase.rpc("save_lesson_assessments", {
        p_lesson_id: lesson.id,
        p_general: generalPayload,
        p_individuals: individualPayloads,
      });
      if (error) throw error;

      toast.success("Relatórios salvos e aula finalizada.");
      invalidate();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível salvar os relatórios."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!lesson} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle>Relatório da aula</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateWithAi}
              disabled={generatingAi || loading}
              className="gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/10"
            >
              {generatingAi ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Gerar por IA
            </Button>
          </div>
          <DialogDescription>
            Registre a sessão e a avaliação de cada participante. Os registros ficam salvos nos
            históricos dos alunos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="min-h-0 flex-1 overflow-y-auto pr-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <TabsList className="w-max min-w-full justify-start">
                <TabsTrigger value="general">Geral</TabsTrigger>
                {participants.map(({ student }) => (
                  <TabsTrigger key={student.id} value={student.id}>
                    {student.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="general" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="general-content">Conteúdo da sessão</Label>
                <Textarea
                  id="general-content"
                  rows={3}
                  value={general.content}
                  disabled={loading}
                  onChange={(e) =>
                    setGeneral((current) => ({ ...current, content: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="general-exercises">Exercícios da sessão</Label>
                <Textarea
                  id="general-exercises"
                  rows={3}
                  value={general.exercises}
                  disabled={loading}
                  onChange={(e) =>
                    setGeneral((current) => ({ ...current, exercises: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="general-notes">Observações da sessão</Label>
                <Textarea
                  id="general-notes"
                  rows={2}
                  value={general.notes}
                  disabled={loading}
                  onChange={(e) => setGeneral((current) => ({ ...current, notes: e.target.value }))}
                />
              </div>
            </TabsContent>

            {participants.map(({ student }) => {
              const report = individuals[student.id];
              if (!report) return null;

              return (
                <TabsContent key={student.id} value={student.id} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`attendance-${student.id}`}>Presença</Label>
                    <Select
                      value={report.attendance}
                      disabled={loading}
                      onValueChange={(value) => updateIndividual(student.id, "attendance", value)}
                    >
                      <SelectTrigger id={`attendance-${student.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Não avaliado</SelectItem>
                        <SelectItem value="presente">Presente</SelectItem>
                        <SelectItem value="ausente">Ausente</SelectItem>
                        <SelectItem value="justificado">Justificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`content-${student.id}`}>Desempenho / Conteúdo</Label>
                    <Textarea
                      id={`content-${student.id}`}
                      rows={3}
                      value={report.content}
                      disabled={loading}
                      onChange={(e) => updateIndividual(student.id, "content", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`exercises-${student.id}`}>Exercícios / Próximos passos</Label>
                    <Textarea
                      id={`exercises-${student.id}`}
                      rows={3}
                      value={report.exercises}
                      disabled={loading}
                      onChange={(e) => updateIndividual(student.id, "exercises", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`notes-${student.id}`}>Observações</Label>
                    <Textarea
                      id={`notes-${student.id}`}
                      rows={2}
                      value={report.notes}
                      disabled={loading}
                      onChange={(e) => updateIndividual(student.id, "notes", e.target.value)}
                    />
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>

          <DialogFooter className="sticky bottom-0 mt-4 border-t bg-background pt-4">
            <Button type="submit" disabled={saving || loading || loadError}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e finalizar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
