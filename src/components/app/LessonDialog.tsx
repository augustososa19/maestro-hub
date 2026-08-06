import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useAvailability,
  useBlockedDates,
  useInvalidateAll,
  useStudentPrograms,
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
import { Checkbox } from "@/components/ui/checkbox";
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

type ParticipantDraft = {
  studentId: string;
  programId?: string | undefined;
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
  const { data: studentPrograms = [] } = useStudentPrograms();
  const { data: availability = [] } = useAvailability();
  const { data: blocks = [] } = useBlockedDates();

  const [duplicating, setDuplicating] = useState(false);
  const editing = !!draft?.lesson && !draft.duplicate && !duplicating;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
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
  const defaultsApplied = useRef(false);

  useEffect(() => {
    if (!draft) return;
    const base = draft.lesson;
    const start = base ? new Date(base.starts_at) : (draft.startsAt ?? nextHour());
    setParticipants(
      base?.participants?.length
        ? base.participants.map((participant) => ({
            studentId: participant.student_id,
            programId: participant.student_program_id ?? undefined,
          }))
        : base?.student_id
          ? [{ studentId: base.student_id }]
          : draft.studentId
            ? [{ studentId: draft.studentId }]
            : [],
    );
    setDate(toDateInput(start));
    setTime(toTimeInput(start));
    setDuration(String(base?.duration_minutes ?? 60));
    setType(base?.lesson_type ?? "presencial");
    setStatus(draft.duplicate ? "agendada" : (base?.status ?? "agendada"));
    setLocation(base?.location ?? "");
    setNotes(draft.duplicate ? (base?.notes ?? "") : (base?.notes ?? ""));
    setShowNewStudent(false);
    setNewStudentName("");
    setNewStudentWhatsapp("");
    setDuplicating(!!draft.duplicate);
    defaultsApplied.current = false;
  }, [draft]);

  const programsByStudent = useMemo(() => {
    const grouped = new Map<string, typeof studentPrograms>();
    for (const program of studentPrograms) {
      grouped.set(program.student_id, [...(grouped.get(program.student_id) ?? []), program]);
    }
    return grouped;
  }, [studentPrograms]);

  useEffect(() => {
    if (studentPrograms.length === 0) return;
    setParticipants((current) => {
      let changed = false;
      const next = current.map((participant) => {
        if (participant.programId) return participant;
        const programs = programsByStudent.get(participant.studentId) ?? [];
        const program = programs.find((item) => item.is_primary) ?? programs[0];
        if (!program) return participant;
        changed = true;
        return { ...participant, programId: program.id };
      });
      return changed ? next : current;
    });
  }, [programsByStudent, studentPrograms.length]);

  const firstStudent = useMemo(
    () => students.find((student) => student.id === participants[0]?.studentId),
    [students, participants],
  );

  useEffect(() => {
    if (!draft || draft.lesson || !firstStudent || defaultsApplied.current) return;
    if (firstStudent.default_duration) setDuration(String(firstStudent.default_duration));
    setType(firstStudent.default_lesson_type);
    if (firstStudent.default_location) setLocation(firstStudent.default_location);
    defaultsApplied.current = true;
  }, [firstStudent, draft]);

  const availabilityCheck = useMemo(() => {
    if (!date || !time) return { ok: true } as const;
    return isWithinAvailability(
      fromDateTimeInput(date, time),
      Number(duration),
      availability,
      blocks,
    );
  }, [date, time, duration, availability, blocks]);

  const createStudent = async () => {
    if (!user || !newStudentName.trim()) return;
    setSavingStudent(true);
    try {
      const { data: studentId, error: studentError } = await supabase.rpc(
        "save_student_with_programs",
        {
          p_student: {
            name: newStudentName.trim(),
            whatsapp: newStudentWhatsapp || null,
            instrument: newStudentInstrument,
            status: "ativo",
          },
          p_programs: [
            {
              instrument: newStudentInstrument,
              is_primary: true,
              billing_type: "mensalidade",
              auto_billing: false,
              active: true,
            },
          ],
        },
      );
      if (studentError) throw studentError;

      const { data: programData, error: programError } = await supabase
        .from("student_programs")
        .select("id")
        .eq("student_id", studentId)
        .eq("is_primary", true)
        .single();
      if (programError) throw programError;

      toast.success(`Aluno "${newStudentName}" cadastrado!`);
      await invalidate();
      setParticipants((current) => [
        ...current.filter((participant) => participant.studentId !== studentId),
        { studentId, programId: programData.id },
      ]);
      setShowNewStudent(false);
      setNewStudentName("");
      setNewStudentWhatsapp("");
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível cadastrar o aluno."));
    } finally {
      setSavingStudent(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (participants.length === 0) {
      toast.error("Selecione ao menos um aluno.");
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
      student_id: participants[0]!.studentId,
      starts_at: fromDateTimeInput(date, time).toISOString(),
      duration_minutes: Number(duration),
      lesson_type: type as never,
      status: (editing ? status : "agendada") as never,
      location: location || null,
      notes: notes || null,
    };
    try {
      const { error } = await supabase.rpc("save_lesson_with_participants", {
        p_lesson_id: editing ? draft!.lesson!.id : null,
        p_lesson: payload,
        p_participants: participants.map((participant) => ({
          student_id: participant.studentId,
          student_program_id: participant.programId ?? null,
        })),
      });
      if (error) throw error;

      toast.success(
        duplicating ? "Aula duplicada." : editing ? "Aula atualizada." : "Aula agendada.",
      );
      await invalidate();
      onOpenChange(false);
    } catch (error) {
      const message = errorMessage(error, "Não foi possível salvar a aula.");
      toast.error(message.includes("Conflito") ? "Conflito de horário com outra aula." : message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.lesson) return;
    if (!window.confirm("Excluir esta aula? Participantes e relatórios também serão removidos.")) {
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("lessons").delete().eq("id", draft.lesson.id);
    setDeleting(false);
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
            {duplicating
              ? `Duplicar aula${participants.length > 1 ? " coletiva" : ""}`
              : editing
                ? `Editar aula${participants.length > 1 ? " coletiva" : ""}`
                : `Nova aula${participants.length > 1 ? " coletiva" : ""}`}
          </DialogTitle>
          <DialogDescription>
            {participants.length > 1
              ? "Aula coletiva: ajuste os participantes, programas e demais detalhes."
              : duplicating
                ? "Crie uma nova aula a partir desta, ajustando o que precisar."
                : editing
                  ? "Altere, remarque ou cancele esta aula."
                  : "Agende dentro dos seus horários disponíveis."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Alunos</Label>
              <button
                type="button"
                onClick={() => setShowNewStudent((v) => !v)}
                className="text-xs font-medium text-primary hover:underline focus:outline-none"
              >
                {showNewStudent ? "← Cancelar" : "+ Novo aluno"}
              </button>
            </div>

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
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
                {students.length === 0 ? (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                    Nenhum aluno. Clique em + Novo aluno.
                  </p>
                ) : (
                  students.map((student) => {
                    const participant = participants.find((item) => item.studentId === student.id);
                    const programs = programsByStudent.get(student.id) ?? [];
                    return (
                      <div
                        key={student.id}
                        className="flex min-h-9 items-center gap-2 rounded px-2 py-1 hover:bg-muted/60"
                      >
                        <Checkbox
                          id={`lesson-student-${student.id}`}
                          checked={!!participant}
                          onCheckedChange={(checked) => {
                            setParticipants((current) => {
                              if (!checked) {
                                return current.filter((item) => item.studentId !== student.id);
                              }
                              if (current.some((item) => item.studentId === student.id)) {
                                return current;
                              }
                              const program =
                                programs.find((item) => item.is_primary) ?? programs[0];
                              return [
                                ...current,
                                { studentId: student.id, programId: program?.id },
                              ];
                            });
                          }}
                        />
                        <Label
                          htmlFor={`lesson-student-${student.id}`}
                          className="min-w-0 flex-1 cursor-pointer truncate font-normal"
                        >
                          {student.name}
                        </Label>
                        {participant && programs.length > 1 ? (
                          <Select
                            value={participant.programId ?? ""}
                            onValueChange={(programId) =>
                              setParticipants((current) =>
                                current.map((item) =>
                                  item.studentId === student.id ? { ...item, programId } : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue placeholder="Programa" />
                            </SelectTrigger>
                            <SelectContent>
                              {programs.map((program) => (
                                <SelectItem key={program.id} value={program.id}>
                                  {program.instrument}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="max-w-32 truncate text-xs text-muted-foreground">
                            {programs[0]?.instrument ?? student.instrument}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
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
                    disabled={deleting}
                    className="text-destructive"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Excluir
                  </Button>
                </div>
              </>
            ) : duplicating ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDuplicating(false);
                  setStatus(draft?.lesson?.status ?? "agendada");
                }}
              >
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

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}
