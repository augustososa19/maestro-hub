import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { BellRing, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadToMedia } from "@/lib/storage";
import {
  useAvailability,
  useBlockedDates,
  useInvalidateAll,
  useProfile,
} from "@/hooks/useMusicData";
import { useTheme } from "@/hooks/useTheme";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { WEEKDAYS } from "@/lib/domain";
import { addDays, formatCivilDate, parseCivilDate } from "@/lib/dates";
import { PageHeader } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · MusicCRM" },
      {
        name: "description",
        content: "Perfil do professor, horários de atendimento e bloqueios de agenda.",
      },
      { property: "og:title", content: "Configurações · MusicCRM" },
      {
        property: "og:description",
        content: "Perfil, horários de atendimento e bloqueios de agenda.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateAll();
  const { theme, setTheme } = useTheme();
  const { data: profile } = useProfile();
  const { data: availability = [] } = useAvailability();
  const { data: blocks = [] } = useBlockedDates();
  const push = usePushNotifications();

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [slot, setSlot] = useState({ weekday: "1", start: "08:00", end: "18:00" });
  const [block, setBlock] = useState({ start: "", end: "", reason: "" });

  useEffect(() => {
    if (!profile) return;
    setName(profile.full_name ?? "");
    setWhatsapp(profile.whatsapp ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  const pickPhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const { signedUrl } = await uploadToMedia(file, user.id, "perfil");
      setAvatarUrl(signedUrl);
    } catch {
      toast.error("Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, whatsapp: whatsapp || null, avatar_url: avatarUrl || null })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil atualizado.");
    invalidate();
  };

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("availability").insert({
      teacher_id: user.id,
      weekday: Number(slot.weekday),
      start_time: slot.start,
      end_time: slot.end,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
  };

  const addBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !block.start) return;
    if (block.end && block.end < block.start) {
      toast.error("A data final não pode ser anterior à inicial.");
      return;
    }
    const endDate = block.end || block.start;
    const rangeStart = parseCivilDate(block.start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = addDays(parseCivilDate(endDate), 1);
    rangeEnd.setHours(0, 0, 0, 0);
    const [lessonsResult, eventsResult] = await Promise.all([
      supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelada")
        .gte("starts_at", rangeStart.toISOString())
        .lt("starts_at", rangeEnd.toISOString()),
      supabase
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo")
        .lt("starts_at", rangeEnd.toISOString())
        .gt("ends_at", rangeStart.toISOString()),
    ]);
    if (lessonsResult.error || eventsResult.error) {
      toast.error("Não foi possível verificar os conflitos deste período.");
      return;
    }
    const conflictCount = (lessonsResult.count ?? 0) + (eventsResult.count ?? 0);
    if (
      conflictCount > 0 &&
      !window.confirm(
        `Existem ${conflictCount} aula${conflictCount === 1 ? " ou compromisso" : "s ou compromissos"} neste período. Deseja bloquear mesmo assim? Os itens existentes continuarão visíveis.`,
      )
    ) {
      return;
    }
    const { error } = await supabase.from("blocked_dates").insert({
      teacher_id: user.id,
      start_date: block.start,
      end_date: endDate,
      reason: block.reason || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBlock({ start: "", end: "", reason: "" });
    invalidate();
  };

  const removeRow = async (table: "availability" | "blocked_dates", id: string) => {
    await supabase.from(table).delete().eq("id", id);
    invalidate();
  };

  const togglePush = async (enabled: boolean) => {
    try {
      if (enabled) await push.enable();
      else await push.disable();
      toast.success(
        enabled ? "Notificações ativadas neste dispositivo." : "Notificações desativadas.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível atualizar as notificações.",
      );
    }
  };

  const updatePushPreference = async (
    updates: Partial<Parameters<typeof push.savePreferences>[0]>,
  ) => {
    try {
      await push.savePreferences(updates);
      toast.success("Preferência atualizada.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a preferência.",
      );
    }
  };

  return (
    <div className="space-y-4 animate-fade-up sm:space-y-5">
      <PageHeader title="Configurações" description="Perfil, disponibilidade e preferências." />

      <section className="panel space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Perfil</h2>
        <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <Avatar className="h-16 w-16 shrink-0 ring-2 ring-border">
              <AvatarImage src={avatarUrl} alt={name} />
              <AvatarFallback className="text-sm">{initials(name || "?")}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <input
                id="foto-prof"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])}
              />
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                <label htmlFor="foto-prof" className="cursor-pointer">
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
          <div className="space-y-2">
            <Label htmlFor="nome-prof">Nome</Label>
            <Input id="nome-prof" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa-prof">WhatsApp</Label>
            <Input id="wa-prof" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">
              Salvar perfil
            </Button>
          </div>
        </form>
      </section>

      <section className="panel space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Horários de atendimento</h2>
        <ul className="space-y-2">
          {availability.map((a) => (
            <li
              key={a.id}
              className="panel-hover grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm transition-colors hover:border-primary/25"
            >
              <span className="truncate font-medium">
                {WEEKDAYS[a.weekday]?.label}{" "}
                <span className="text-muted-foreground">
                  · {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover"
                onClick={() => removeRow("availability", a.id)}
                className="press text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {availability.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Defina ao menos um dia disponível para agendar aulas.
            </li>
          )}
        </ul>
        <form
          onSubmit={addSlot}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end"
        >
          <div className="space-y-2">
            <Label>Dia</Label>
            <Select
              value={slot.weekday}
              onValueChange={(v) => setSlot((s) => ({ ...s, weekday: v }))}
            >
              <SelectTrigger>
                <SelectValue />
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
            <Label htmlFor="ini">Início</Label>
            <Input
              id="ini"
              type="time"
              value={slot.start}
              onChange={(e) => setSlot((s) => ({ ...s, start: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fim">Fim</Label>
            <Input
              id="fim"
              type="time"
              value={slot.end}
              onChange={(e) => setSlot((s) => ({ ...s, end: e.target.value }))}
            />
          </div>
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </form>
      </section>

      <section className="panel space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Datas bloqueadas</h2>
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="panel-hover grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm transition-colors hover:border-primary/25"
            >
              <span className="truncate">
                {formatCivilDate(b.start_date)} — {formatCivilDate(b.end_date)}
                {b.reason ? ` · ${b.reason}` : ""}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover"
                onClick={() => removeRow("blocked_dates", b.id)}
                className="press text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={addBlock}
          className="grid gap-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="b-ini">De</Label>
            <Input
              id="b-ini"
              type="date"
              value={block.start}
              onChange={(e) => setBlock((b) => ({ ...b, start: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-fim">Até</Label>
            <Input
              id="b-fim"
              type="date"
              value={block.end}
              onChange={(e) => setBlock((b) => ({ ...b, end: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-mot">Motivo</Label>
            <Input
              id="b-mot"
              value={block.reason}
              onChange={(e) => setBlock((b) => ({ ...b, reason: e.target.value }))}
            />
          </div>
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" /> Bloquear
          </Button>
        </form>
      </section>

      <section className="panel space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BellRing className="h-4 w-4 text-primary" /> Notificações no celular
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Receba lembretes mesmo com o sistema fechado. No iPhone, adicione o MusicCRM à Tela de
              Início antes de ativar.
            </p>
          </div>
          <Switch
            aria-label="Ativar notificações"
            checked={push.subscribed && push.permission === "granted"}
            disabled={push.busy || push.isLoading || !push.supported || !push.configured}
            onCheckedChange={togglePush}
          />
        </div>

        {!push.supported && (
          <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            Este navegador não oferece Web Push. Use Chrome no Android ou instale o site na Tela de
            Início no iPhone.
          </p>
        )}
        {push.supported && !push.configured && (
          <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            A infraestrutura está pronta, mas a variável VITE_VAPID_PUBLIC_KEY precisa ser
            configurada no ambiente do projeto.
          </p>
        )}
        {push.permission === "denied" && (
          <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            As notificações foram bloqueadas no navegador. Libere a permissão nas configurações do
            site e tente novamente.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Lembrar aulas</Label>
            <Select
              value={String(push.preferences.lesson_minutes)}
              disabled={!push.preferences.enabled}
              onValueChange={(value) => updatePushPreference({ lesson_minutes: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 minutos antes</SelectItem>
                <SelectItem value="30">30 minutos antes</SelectItem>
                <SelectItem value="60">1 hora antes</SelectItem>
                <SelectItem value="1440">1 dia antes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Lembrar compromissos</Label>
            <Select
              value={String(push.preferences.event_minutes)}
              disabled={!push.preferences.enabled}
              onValueChange={(value) => updatePushPreference({ event_minutes: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 minutos antes</SelectItem>
                <SelectItem value="30">30 minutos antes</SelectItem>
                <SelectItem value="60">1 hora antes</SelectItem>
                <SelectItem value="1440">1 dia antes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:self-end">
            <Label htmlFor="payment-push">Vencimentos</Label>
            <Switch
              id="payment-push"
              checked={push.preferences.payment_notifications}
              disabled={!push.preferences.enabled}
              onCheckedChange={(checked) =>
                updatePushPreference({ payment_notifications: checked })
              }
            />
          </div>
        </div>
      </section>

      <section className="panel space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Aparência</h2>
        <Select value={theme} onValueChange={(v) => setTheme(v as never)}>
          <SelectTrigger className="sm:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Claro</SelectItem>
            <SelectItem value="dark">Escuro</SelectItem>
            <SelectItem value="system">Sistema</SelectItem>
          </SelectContent>
        </Select>
      </section>
    </div>
  );
}

function initials(value: string) {
  return (
    value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}
