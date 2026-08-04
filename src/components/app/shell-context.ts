import { createContext, useContext } from "react";
import type { LessonDraft } from "@/components/app/LessonDialog";
import type { LessonWithStudent, Student } from "@/lib/domain";

export type ShellApi = {
  openLesson: (draft: LessonDraft) => void;
  openStudent: (student?: Student | null) => void;
  openReport: (lesson: LessonWithStudent) => void;
  openSearch: () => void;
};

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell deve ser usado dentro do layout do app");
  return ctx;
}
