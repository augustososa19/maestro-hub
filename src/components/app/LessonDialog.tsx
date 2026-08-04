import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAvailability, useBlockedDates, useInvalidateAll, useStudents } from "@/hooks/useMusicData";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const editing = !!draft?.lesson && !draft.duplicate;
  const [saving, setSaving] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [type, setType] = useState("presencial");
  const [status, setStatus] = useState("agendada");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

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
    return isWithinAvailability(fromDateTimeInput(date, time), Number(duration), availability, blocks);
  }, [date, time, duration, availability, blocks]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!studentId) {
      toast.error("Selecione um aluno.");
      return;
    }
    if (status !== "cancelada" && !availabilityCheck.ok) {
      toast.error(availabilityCheck.reason ?? "Horário indisponível.");
      return;
    }
    setSaving(true);
    const payload = {
      teacher_id: user.id,
      student_id: studentId,
      starts_at: fromDateTimeInput(date, time).toISOString(),
      duration_minutes: Number(duration),
      lesson_type: type as never,
      status: status as never,
      location: location || null,
      notes: notes || null,
    };
    const query = editing
      ? supabase.from("lessons").update(payload).eq("id", draft!.lesson!.id)
      : supabase.from("lessons").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("Conflito") ? "Conflito de horário com outra aula." : error.message);
      return;
    }
    toast.success(editing ? "Aula atualizada." : "Aula agendada.");
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
          <DialogTitle>{editing ? "Editar aula" : "Nova aula"}</DialogTitle>
          <DialogDescription>
            {editing ? "Altere, remarque ou cancele esta aula." : "Agende dentro dos seus horários disponíveis."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label>Aluno</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o aluno" />
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input id="time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
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

          {!availabilityCheck.ok && (
            <p className="rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
              {availabilityCheck.reason}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button type="button" variant="ghost" onClick={remove} className="text-destructive">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Agendar"}
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
