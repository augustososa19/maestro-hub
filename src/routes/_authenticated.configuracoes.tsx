import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAvailability, useBlockedDates, useInvalidateAll, useProfile } from "@/hooks/useMusicData";
import { useTheme } from "@/hooks/useTheme";
import { WEEKDAYS } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · MusicCRM" },
      { name: "description", content: "Perfil do professor, horários de atendimento e bloqueios de agenda." },
      { property: "og:title", content: "Configurações · MusicCRM" },
      { property: "og:description", content: "Perfil, horários de atendimento e bloqueios de agenda." },
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

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [slot, setSlot] = useState({ weekday: "1", start: "08:00", end: "18:00" });
  const [block, setBlock] = useState({ start: "", end: "", reason: "" });

  useEffect(() => {
    if (!profile) return;
    setName(profile.full_name ?? "");
    setWhatsapp(profile.whatsapp ?? "");
  }, [profile]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, whatsapp: whatsapp || null })
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
    const { error } = await supabase.from("blocked_dates").insert({
      teacher_id: user.id,
      start_date: block.start,
      end_date: block.end || block.start,
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

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Perfil, disponibilidade e preferências.</p>
      </header>

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold">Perfil</h2>
        <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
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

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold">Horários de atendimento</h2>
        <ul className="space-y-2">
          {availability.map((a) => (
            <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <span className="truncate">
                {WEEKDAYS[a.weekday]?.label} · {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
              </span>
              <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => removeRow("availability", a.id)}>
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
        <form onSubmit={addSlot} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
          <div className="space-y-2">
            <Label>Dia</Label>
            <Select value={slot.weekday} onValueChange={(v) => setSlot((s) => ({ ...s, weekday: v }))}>
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
            <Input id="ini" type="time" value={slot.start} onChange={(e) => setSlot((s) => ({ ...s, start: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fim">Fim</Label>
            <Input id="fim" type="time" value={slot.end} onChange={(e) => setSlot((s) => ({ ...s, end: e.target.value }))} />
          </div>
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </form>
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold">Datas bloqueadas</h2>
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <span className="truncate">
                {formatDate(b.start_date)} — {formatDate(b.end_date)}
                {b.reason ? ` · ${b.reason}` : ""}
              </span>
              <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => removeRow("blocked_dates", b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={addBlock} className="grid gap-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="b-ini">De</Label>
            <Input id="b-ini" type="date" value={block.start} onChange={(e) => setBlock((b) => ({ ...b, start: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-fim">Até</Label>
            <Input id="b-fim" type="date" value={block.end} onChange={(e) => setBlock((b) => ({ ...b, end: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-mot">Motivo</Label>
            <Input id="b-mot" value={block.reason} onChange={(e) => setBlock((b) => ({ ...b, reason: e.target.value }))} />
          </div>
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" /> Bloquear
          </Button>
        </form>
      </section>

      <section className="panel space-y-3 p-5">
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
