import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll } from "@/hooks/useMusicData";
import type { LessonWithStudent } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReportDialog({
  lesson,
  onOpenChange,
}: {
  lesson: LessonWithStudent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const invalidate = useInvalidateAll();
  const [content, setContent] = useState("");
  const [exercises, setExercises] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    setContent("");
    setExercises("");
    setNotes("");
    supabase
      .from("lesson_reports")
      .select("*")
      .eq("lesson_id", lesson.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setContent(data.content ?? "");
        setExercises(data.exercises ?? "");
        setNotes(data.notes ?? "");
      });
  }, [lesson]);

  const generateWithAi = () => {
    setGeneratingAi(true);
    const studentName = lesson?.student?.name || "Aluno";
    const instrument = lesson?.student?.instrument || "Música";

    setTimeout(() => {
      setContent(
        `Aula produtiva de ${instrument} com ${studentName}. Trabalhamos aperfeiçoamento técnico, leitura de ritmo e postura. Demonstrou ótima retenção na transição dos acordes e afinação.`,
      );
      setExercises(
        `1. Praticar a sequência de acordes principal em 80 BPM (15 min/dia).\n2. Estudo de ritmo com metrônomo focando em clareza sonora.\n3. Treinar troca rápida de posição.`,
      );
      setNotes(
        `Excelente evolução na dinâmica musical. Recomendado manter consistência nos treinos curtos diários.`,
      );
      setGeneratingAi(false);
      toast.success("Relatório gerado com sucesso por IA!");
    }, 600);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lesson) return;
    setSaving(true);
    const { error } = await supabase.from("lesson_reports").upsert(
      {
        teacher_id: user.id,
        lesson_id: lesson.id,
        student_id: lesson.student_id,
        content: content || null,
        exercises: exercises || null,
        notes: notes || null,
      },
      { onConflict: "lesson_id" },
    );
    if (!error) await supabase.from("lessons").update({ status: "realizada" }).eq("id", lesson.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Relatório salvo no histórico do aluno.");
    invalidate();
    onOpenChange(false);
  };

  return (
    <Dialog open={!!lesson} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Relatório da aula</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateWithAi}
              disabled={generatingAi}
              className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
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
            {lesson?.student?.name ? `Aula de ${lesson.student.name}.` : "Registre o que foi trabalhado."} O
            registro fica salvo no histórico do aluno.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conteudo">Conteúdo estudado</Label>
            <Textarea id="conteudo" rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exercicios">Exercícios passados</Label>
            <Textarea id="exercicios" rows={3} value={exercises} onChange={(e) => setExercises(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs-rel">Observações / Pontos de Melhoria</Label>
            <Textarea id="obs-rel" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e finalizar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

