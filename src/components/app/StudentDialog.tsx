import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll } from "@/hooks/useMusicData";
import {
  DURATIONS,
  INSTRUMENTS,
  LESSON_TYPES,
  STUDENT_STATUS,
  WEEKDAYS,
  initials,
  type Student,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { uploadToMedia } from "@/lib/storage";

const EMPTY = {
  name: "",
  whatsapp: "",
  email: "",
  instrument: "",
  goal: "",
  notes: "",
  status: "ativo",
  default_weekday: "",
  default_time: "",
  default_duration: "60",
  default_lesson_type: "presencial",
  default_location: "",
  photo_url: "",
};

export function StudentDialog({
  student,
  open,
  onOpenChange,
}: {
  student?: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const invalidate = useInvalidateAll();
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (student) {
      setForm({
        name: student.name,
        whatsapp: student.whatsapp ?? "",
        email: student.email ?? "",
        instrument: student.instrument ?? "",
        goal: student.goal ?? "",
        notes: student.notes ?? "",
        status: student.status,
        default_weekday: student.default_weekday === null ? "" : String(student.default_weekday),
        default_time: student.default_time?.slice(0, 5) ?? "",
        default_duration: String(student.default_duration ?? 60),
        default_lesson_type: student.default_lesson_type,
        default_location: student.default_location ?? "",
        photo_url: student.photo_url ?? "",
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [student, open]);

  const set = (key: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const pickPhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const { signedUrl } = await uploadToMedia(file, user.id, "fotos");
      set("photo_url", signedUrl);
    } catch {
      toast.error("Não foi possível enviar a foto.");
    }
    setUploading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      teacher_id: user.id,
      name: form.name.trim(),
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      instrument: form.instrument,
      goal: form.goal || null,
      notes: form.notes || null,
      status: form.status as never,
      default_weekday: form.default_weekday === "" ? null : Number(form.default_weekday),
      default_time: form.default_time || null,
      default_duration: Number(form.default_duration),
      default_lesson_type: form.default_lesson_type as never,
      default_location: form.default_location || null,
      photo_url: form.photo_url || null,
    };
    const { error } = student
      ? await supabase.from("students").update(payload).eq("id", student.id)
      : await supabase.from("students").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(student ? "Aluno atualizado." : "Aluno cadastrado.");
    invalidate();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{student ? "Editar aluno" : "Novo aluno"}</DialogTitle>
          <DialogDescription>Dados pessoais e informações padrão da aula.</DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0 ring-2 ring-border">
              <AvatarImage src={form.photo_url} alt={form.name} />
              <AvatarFallback>{initials(form.name || "?")}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])}
              />
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                <label htmlFor="photo" className="cursor-pointer">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Foto
                </label>
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">JPG ou PNG.</p>
            </div>
          </div>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa">WhatsApp</Label>
              <Input
                id="wa"
                value={form.whatsapp}
                placeholder="(11) 99999-0000"
                onChange={(e) => set("whatsapp", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail">E-mail (opcional)</Label>
              <Input
                id="mail"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Instrumento</Label>
              <Select value={form.instrument} onValueChange={(v) => set("instrument", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {INSTRUMENTS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="obj">Objetivo</Label>
              <Input id="obj" value={form.goal} onChange={(e) => set("goal", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notas">Observações</Label>
              <Textarea
                id="notas"
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-sm font-medium">Informações da aula</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <Select
                  value={form.default_weekday}
                  onValueChange={(v) => set("default_weekday", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora">Horário habitual</Label>
                <Input
                  id="hora"
                  type="time"
                  value={form.default_time}
                  onChange={(e) => set("default_time", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Duração padrão</Label>
                <Select
                  value={form.default_duration}
                  onValueChange={(v) => set("default_duration", v)}
                >
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
                <Label>Tipo da aula</Label>
                <Select
                  value={form.default_lesson_type}
                  onValueChange={(v) => set("default_lesson_type", v)}
                >
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="local2">Local</Label>
                <Input
                  id="local2"
                  value={form.default_location}
                  onChange={(e) => set("default_location", e.target.value)}
                />
              </div>
            </div>
          </section>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
