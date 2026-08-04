import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, FileText, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useLessons, useMaterials, useStudents } from "@/hooks/useMusicData";
import { formatDateTime } from "@/lib/dates";

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { data: students = [] } = useStudents();
  const { data: lessons = [] } = useLessons();
  const { data: materials = [] } = useMaterials();

  const go = (to: string, params?: Record<string, string>) => {
    onOpenChange(false);
    navigate({ to, params } as never);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar alunos, aulas e materiais…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Alunos">
          {students.slice(0, 20).map((s) => (
            <CommandItem
              key={s.id}
              value={`aluno ${s.name} ${s.instrument}`}
              onSelect={() => go("/alunos/$id", { id: s.id })}
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{s.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{s.instrument}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Aulas">
          {lessons.slice(0, 20).map((l) => (
            <CommandItem
              key={l.id}
              value={`aula ${l.student?.name ?? ""} ${formatDateTime(l.starts_at)}`}
              onSelect={() => go("/agenda")}
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{l.student?.name ?? "Aula"}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(l.starts_at)}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Materiais">
          {materials.slice(0, 20).map((m) => (
            <CommandItem key={m.id} value={`material ${m.title}`} onSelect={() => go("/biblioteca")}>
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{m.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
