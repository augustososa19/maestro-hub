import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteCalendarEvent,
  useSaveCalendarEvent,
  type CalendarEventInput,
} from "@/hooks/useMusicData";
import { addDays } from "@/lib/dates";
import { fromDateTimeInput, toDateInput, toTimeInput, type CalendarEvent } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CalendarEventDraft = {
  event?: CalendarEvent;
  startsAt?: Date;
};

export function CalendarEventDialog({
  draft,
  onOpenChange,
}: {
  draft: CalendarEventDraft | null;
  onOpenChange: (open: boolean) => void;
}) {
  const saveEvent = useSaveCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [blocksLessons, setBlocksLessons] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState("default");

  useEffect(() => {
    if (!draft) return;
    const event = draft.event;
    const start = event ? new Date(event.starts_at) : (draft.startsAt ?? new Date());
    const rawEnd = event ? new Date(event.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
    const displayEnd = event?.all_day ? addDays(rawEnd, -1) : rawEnd;
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setLocation(event?.location ?? "");
    setStartDate(event?.all_day && event.start_date ? event.start_date : toDateInput(start));
    setEndDate(event?.all_day && event.end_date ? event.end_date : toDateInput(displayEnd));
    setStartTime(toTimeInput(start));
    setEndTime(toTimeInput(rawEnd));
    setAllDay(event?.all_day ?? false);
    setBlocksLessons(event?.blocks_lessons ?? true);
    setReminderMinutes(
      !event || event.reminder_minutes === null ? "default" : String(event.reminder_minutes),
    );
  }, [draft]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !title.trim() || !startDate || !endDate) return;

    const start = allDay
      ? fromDateTimeInput(startDate, "00:00")
      : fromDateTimeInput(startDate, startTime);
    const end = allDay
      ? addDays(fromDateTimeInput(endDate, "00:00"), 1)
      : fromDateTimeInput(endDate, endTime);
    if (end <= start) {
      toast.error("O término precisa ser posterior ao início.");
      return;
    }

    const payload: CalendarEventInput = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: allDay,
      start_date: allDay ? startDate : null,
      end_date: allDay ? endDate : null,
      blocks_lessons: blocksLessons,
      location: location.trim() || null,
      reminder_minutes: reminderMinutes === "default" ? null : Number(reminderMinutes),
      ...(draft.event ? { id: draft.event.id } : {}),
    };

    try {
      await saveEvent.mutateAsync(payload);
      toast.success(draft.event ? "Compromisso atualizado." : "Compromisso adicionado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async () => {
    if (!draft?.event || !window.confirm("Excluir este compromisso?")) return;
    try {
      await deleteEvent.mutateAsync(draft.event.id);
      toast.success("Compromisso excluído.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={draft !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.event ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="event-title">Título</Label>
            <Input
              id="event-title"
              required
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Consulta, ensaio ou reunião"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="event-all-day">Dia inteiro</Label>
              <p className="text-xs text-muted-foreground">
                Ocupa todos os horários das datas escolhidas.
              </p>
            </div>
            <Switch id="event-all-day" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="event-start-date">Início</Label>
              <Input
                id="event-start-date"
                type="date"
                required
                value={startDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setStartDate(value);
                  if (!endDate || endDate < value) setEndDate(value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end-date">Término</Label>
              <Input
                id="event-end-date"
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            {!allDay && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="event-start-time">Horário inicial</Label>
                  <Input
                    id="event-start-time"
                    type="time"
                    required
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-end-time">Horário final</Label>
                  <Input
                    id="event-end-time"
                    type="time"
                    required
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-location">Local</Label>
              <Input
                id="event-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Lembrar</Label>
              <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão das configurações</SelectItem>
                  <SelectItem value="0">No horário</SelectItem>
                  <SelectItem value="10">10 minutos antes</SelectItem>
                  <SelectItem value="30">30 minutos antes</SelectItem>
                  <SelectItem value="60">1 hora antes</SelectItem>
                  <SelectItem value="1440">1 dia antes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="event-blocks">Bloquear novas aulas</Label>
              <p className="text-xs text-muted-foreground">
                Desative para manter apenas como informação na agenda.
              </p>
            </div>
            <Switch id="event-blocks" checked={blocksLessons} onCheckedChange={setBlocksLessons} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Observações</Label>
            <Textarea
              id="event-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {draft?.event ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={deleteEvent.isPending}
                onClick={remove}
              >
                {deleteEvent.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saveEvent.isPending}>
              {saveEvent.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar compromisso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Não foi possível salvar o compromisso.";
}
