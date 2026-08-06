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
import { useLessons, useMaterials, useStudentPrograms, useStudents } from "@/hooks/useMusicData";
import { formatDateTime } from "@/lib/dates";
import { lessonStudentLabel } from "@/lib/domain";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: students = [] } = useStudents();
  const { data: programs = [] } = useStudentPrograms();
  const { data: lessons = [] } = useLessons();
  const { data: materials = [] } = useMaterials();
  const instrumentsOf = (studentId: string, fallback: string) =>
    programs
      .filter((program) => program.student_id === studentId && program.active)
      .map((program) => program.instrument)
      .join(" · ") || fallback;

  const go = (
    to: string,
    params?: Record<string, string>,
    search?: Record<string, string | undefined>,
  ) => {
    onOpenChange(false);
    navigate({ to, params, search } as never);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar alunos, aulas e materiais…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Alunos">
          {students.map((s) => (
            <CommandItem
              key={s.id}
              value={`aluno ${s.name} ${instrumentsOf(s.id, s.instrument)}`}
              onSelect={() => go("/alunos/$id", { id: s.id })}
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{s.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {instrumentsOf(s.id, s.instrument)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Aulas">
          {lessons.map((l) => (
            <CommandItem
              key={l.id}
              value={`aula ${lessonStudentLabel(l)} ${formatDateTime(l.starts_at)}`}
              onSelect={() =>
                go("/agenda", undefined, {
                  date: l.starts_at.slice(0, 10),
                  lessonId: l.id,
                })
              }
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{lessonStudentLabel(l)}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDateTime(l.starts_at)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Materiais">
          {materials.map((m) => (
            <CommandItem
              key={m.id}
              value={`material ${m.title}`}
              onSelect={() => go("/biblioteca")}
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{m.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
