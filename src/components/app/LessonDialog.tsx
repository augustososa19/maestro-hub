import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useAvailability,
  useBlockedDates,
  useInvalidateAll,
  useStudents,
} from "@/hooks/useMusicData";
import {
  DURATIONS,
  LESSON_TYPES,
  LESSON_STATUS,
  fromDateTimeInput,
  isWithinAvailability,
  toDateInput,
  toTimeInput,
  type LessonWithStudent,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LessonDraft = {
  lesson?: LessonWithStudent | null;
  startsAt?: Date;
  studentId?: string;
  duplicate?: boolean;
};

export function LessonDialog({
  draft,
  onOpenChange,
}: {
  draft: LessonDraft | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const invalidate = useInvalidateAll();
  const { data: students = [] } = useStudents();
  const { data: availability = [] } = useAvailability();
  const { data: blocks = [] } = useBlockedDates();

  const [duplicating, setDuplicating] = useState(false);
  const editing = !!draft?.lesson && !draft.duplicate && !duplicating;
  const [saving, setSaving] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [type, setType] = useState("presencial");
  const [status, setStatus] = useState("agendada");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Quick-create student state
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentWhatsapp, setNewStudentWhatsapp] = useState("");
  const [newStudentInstrument, setNewStudentInstrument] = useState("Violão");
  const [savingStudent, setSavingStudent] = useState(false);

  useEffect(() => {
    if (!draft) return;
    const base = draft.lesson;
    const start = base ? new Date(base.starts_at) : (draft.startsAt ?? nextHour());
    setStudentId(base?.student_id ?? draft.studentId ?? "");
    setDate(toDateInput(start));
    setTime(toTimeInput(start));
    setDuration(String(base?.duration_minutes ?? 60));
    setType(base?.lesson_type ?? "presencial");
    setStatus(base?.status ?? "agendada");
    setLocation(base?.location ?? "");
    setNotes(draft.duplicate ? (base?.notes ?? "") : (base?.notes ?? ""));
    setShowNewStudent(false);
    setNewStudentName("");
    setNewStudentWhatsapp("");
    setDuplicating(!!draft.duplicate);
  }, [draft]);

  const student = useMemo(() => students.find((s) => s.id === studentId), [students, studentId]);

  useEffect(() => {
    if (!draft || draft.lesson || !student) return;
    if (student.default_duration) setDuration(String(student.default_duration));
    setType(student.default_lesson_type);
    if (student.default_location) setLocation(student.default_location);
  }, [student, draft]);

  const availabilityCheck = useMemo(() => {
    if (!date || !time) return { ok: true } as const;
    return isWithinAvailability(
      fromDateTimeInput(date, time),
      Number(duration),
      availability,
      blocks,
    );
  }, [date, time, duration, availability, blocks]);

  const createStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newStudentName.trim()) return;
    setSavingStudent(true);
    const { data, error } = await supabase
      .from("students")
      .insert({
        teacher_id: user.id,
        name: newStudentName.trim(),
        whatsapp: newStudentWhatsapp || null,
        instrument: newStudentInstrument,
        status: "ativo",
      })
      .select()
      .single();
    setSavingStudent(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Aluno "${newStudentName}" cadastrado!`);
    await invalidate();
    setStudentId(data.id);
    setShowNewStudent(false);
    setNewStudentName("");
    setNewStudentWhatsapp("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!studentId) {
      toast.error("Selecione um aluno.");
      return;
    }
    // Bloqueia somente se o professor configurou disponibilidade e o horário está fora
    // (quando não há disponibilidade configurada, qualquer horário é válido)
    if (status !== "cancelada" && !availabilityCheck.ok && availabilityCheck.reason) {
      // Só bloqueia se for por dia bloqueado explicitamente, não por falta de configuração
      if (availabilityCheck.reason.startsWith("Dia bloqueado")) {
        toast.error(availabilityCheck.reason);
        return;
      }
      // Para restrições de horário, mostra aviso mas deixa salvar
      toast.warning(`Aviso: ${availabilityCheck.reason}`);
    }
    setSaving(true);
    const payload = {
      teacher_id: user.id,
      student_id: studentId,
      starts_at: fromDateTimeInput(date, time).toISOString(),
      duration_minutes: Number(duration),
      lesson_type: type as never,
      status: "agendada" as never,
      location: location || null,
      notes: notes || null,
    };
    const query = editing
      ? supabase.from("lessons").update(payload).eq("id", draft!.lesson!.id)
      : supabase.from("lessons").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("Conflito") ? "Conflito de horário com outra aula." : error.message,
      );
      return;
    }
    toast.success(
      duplicating ? "Aula duplicada." : editing ? "Aula atualizada." : "Aula agendada.",
    );
    invalidate();
    onOpenChange(false);
  };

  const remove = async () => {
    if (!draft?.lesson) return;
    const { error } = await supabase.from("lessons").delete().eq("id", draft.lesson.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Aula excluída.");
    invalidate();
    onOpenChange(false);
  };

  return (
    <Dialog open={!!draft} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {duplicating ? "Duplicar aula" : editing ? "Editar aula" : "Nova aula"}
          </DialogTitle>
          <DialogDescription>
            {duplicating
              ? "Crie uma nova aula a partir desta, ajustando o que precisar."
              : editing
                ? "Altere, remarque ou cancele esta aula."
                : "Agende dentro dos seus horários disponíveis."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          {/* Seleção de Aluno + botão Novo Aluno */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Aluno</Label>
              <button
                type="button"
                onClick={() => setShowNewStudent((v) => !v)}
                className="text-xs font-medium text-primary hover:underline focus:outline-none"
              >
                {showNewStudent ? "← Cancelar" : "+ Novo aluno"}
              </button>
            </div>

            {/* Painel inline de cadastro rápido */}
            {showNewStudent ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-xs font-semibold text-primary">Cadastro rápido de aluno</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="ns-nome" className="text-xs">
                      Nome *
                    </Label>
                    <Input
                      id="ns-nome"
                      placeholder="Nome completo"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-wa" className="text-xs">
                      WhatsApp
                    </Label>
                    <Input
                      id="ns-wa"
                      placeholder="(11) 99999-0000"
                      value={newStudentWhatsapp}
                      onChange={(e) => setNewStudentWhatsapp(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ns-inst" className="text-xs">
                      Instrumento
                    </Label>
                    <select
                      id="ns-inst"
                      value={newStudentInstrument}
                      onChange={(e) => setNewStudentInstrument(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {[
                        "Violão",
                        "Guitarra",
                        "Piano",
                        "Teclado",
                        "Baixo",
                        "Bateria",
                        "Canto",
                        "Violino",
                        "Saxofone",
                        "Flauta",
                        "Ukulele",
                        "Outro",
                      ].map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={savingStudent || !newStudentName.trim()}
                  onClick={createStudent}
                >
                  {savingStudent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Salvar e selecionar aluno"
                  )}
                </Button>
              </div>
            ) : (
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      students.length === 0
                        ? "Nenhum aluno — clique em + Novo aluno"
                        : "Selecione o aluno"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.instrument ? ` · ${s.instrument}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="local">Local</Label>
            <Input
              id="local"
              value={location}
              placeholder="Estúdio, casa do aluno, link da chamada…"
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {editing && (
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {!availabilityCheck.ok && availabilityCheck.reason && (
            <p
              className={`rounded-md px-3 py-2 text-xs ${
                availabilityCheck.reason.startsWith("Dia bloqueado")
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              {availabilityCheck.reason.startsWith("Dia bloqueado") ? "🚫" : "⚠️"}{" "}
              {availabilityCheck.reason}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDuplicating(true);
                      setStatus("agendada");
                    }}
                    className="text-foreground"
                  >
                    <Copy className="h-4 w-4" /> Duplicar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={remove}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>
              </>
            ) : duplicating ? (
              <Button type="button" variant="ghost" onClick={() => setDuplicating(false)}>
                ← Voltar
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving || showNewStudent}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : duplicating ? (
                "Criar cópia"
              ) : editing ? (
                "Salvar"
              ) : (
                "Agendar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
