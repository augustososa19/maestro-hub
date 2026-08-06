import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  Availability,
  BlockedDate,
  FinancialTransaction,
  Lesson,
  LessonReport,
  LessonWithStudent,
  Material,
  Profile,
  Student,
  StudentProgram,
} from "@/lib/domain";

const LESSON_SELECT =
  "*, student:students(id, name, photo_url, instrument), participants:lesson_participants(*, student:students(id, name, photo_url, instrument), program:student_programs(id, instrument))";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useStudents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["students", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Student[]> => {
      const { data, error } = await supabase.from("students").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStudent(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student", id, user?.id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<Student | null> => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useLessons(range?: { from: Date; to: Date }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lessons", user?.id, range?.from.toISOString(), range?.to.toISOString()],
    enabled: !!user,
    queryFn: async (): Promise<LessonWithStudent[]> => {
      let query = supabase.from("lessons").select(LESSON_SELECT).order("starts_at");
      if (range) {
        query = query
          .gte("starts_at", range.from.toISOString())
          .lt("starts_at", range.to.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((lesson) => ({
        ...lesson,
        participants: Array.isArray(lesson.participants) ? lesson.participants : [],
      })) as unknown as LessonWithStudent[];
    },
  });
}

export function useStudentLessons(studentId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-lessons", studentId, user?.id],
    enabled: !!user && !!studentId,
    queryFn: async (): Promise<LessonWithStudent[]> => {
      const { data: participantRows, error: participantError } = await supabase
        .from("lesson_participants")
        .select("lesson_id")
        .eq("student_id", studentId);
      if (participantError) throw participantError;

      const lessonIds = [...new Set((participantRows ?? []).map((row) => row.lesson_id))];
      let query = supabase.from("lessons").select(LESSON_SELECT);
      query = lessonIds.length
        ? query.or(`student_id.eq.${studentId},id.in.(${lessonIds.join(",")})`)
        : query.eq("student_id", studentId);

      const { data, error } = await query.order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((lesson) => ({
        ...lesson,
        participants: Array.isArray(lesson.participants) ? lesson.participants : [],
      })) as unknown as LessonWithStudent[];
    },
  });
}

export function useStudentReports(studentId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-reports", studentId, user?.id],
    enabled: !!user && !!studentId,
    queryFn: async (): Promise<LessonReport[]> => {
      const [participantsResult, legacyLessonsResult, reportsResult] = await Promise.all([
        supabase.from("lesson_participants").select("lesson_id").eq("student_id", studentId),
        supabase.from("lessons").select("id").eq("student_id", studentId),
        supabase.from("lesson_reports").select("*").order("created_at", { ascending: false }),
      ]);
      if (participantsResult.error) throw participantsResult.error;
      if (legacyLessonsResult.error) throw legacyLessonsResult.error;
      if (reportsResult.error) throw reportsResult.error;

      const lessonIds = new Set([
        ...(participantsResult.data ?? []).map((row) => row.lesson_id),
        ...(legacyLessonsResult.data ?? []).map((row) => row.id),
      ]);
      return (reportsResult.data ?? []).filter(
        (report) =>
          report.student_id === studentId ||
          (report.scope === "geral" && lessonIds.has(report.lesson_id)),
      );
    },
  });
}

export function useStudentPrograms(studentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-programs", user?.id, studentId ?? "all"],
    enabled: !!user,
    queryFn: async (): Promise<StudentProgram[]> => {
      let query = supabase
        .from("student_programs")
        .select("*")
        .eq("active", true)
        .order("instrument");
      if (studentId) query = query.eq("student_id", studentId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMaterials(studentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["materials", user?.id, studentId ?? "all"],
    enabled: !!user,
    queryFn: async (): Promise<Material[]> => {
      let query = supabase.from("materials").select("*").order("created_at", { ascending: false });
      if (studentId) query = query.eq("student_id", studentId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAvailability() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["availability", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Availability[]> => {
      const { data, error } = await supabase
        .from("availability")
        .select("*")
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBlockedDates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["blocked", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BlockedDate[]> => {
      const { data, error } = await supabase.from("blocked_dates").select("*").order("start_date");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      "lessons",
      "students",
      "student",
      "student-lessons",
      "student-reports",
      "materials",
      "availability",
      "blocked",
      "profile",
      "student-programs",
      "lesson-participants",
      "financial-transactions",
    ]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useDeleteMutation(
  table: "students" | "lessons" | "materials" | "availability" | "blocked_dates",
) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useFinancialTransactions(month?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financial-transactions", user?.id, month ?? "all"],
    enabled: !!user,
    queryFn: async (): Promise<FinancialTransaction[]> => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (!month || month === currentMonth) {
        const { error } = await supabase.rpc("generate_monthly_charges", {
          p_competence: `${month ?? currentMonth}-01`,
        });
        if (error) throw error;
      }

      let query = supabase
        .from("financial_transactions")
        .select("*")
        .order("due_date", { ascending: false });
      if (month) {
        const [year, monthNumber] = month.split("-").map(Number);
        const nextMonth = new Date(Date.UTC(year!, monthNumber!, 1)).toISOString().slice(0, 10);
        query = query.gte("competence_date", `${month}-01`).lt("competence_date", nextMonth);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as FinancialTransaction[];
    },
  });
}

type AddFinancialTransactionInput = Omit<
  FinancialTransaction,
  "id" | "teacher_id" | "competence_date"
> & {
  competence_date?: string;
};

export function useAddFinancialTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: AddFinancialTransactionInput): Promise<FinancialTransaction> => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { data, error } = await supabase
        .from("financial_transactions")
        .insert({ ...tx, teacher_id: user.id })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as FinancialTransaction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
  });
}

export function useUpdateFinancialTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Pick<FinancialTransaction, "id"> &
      Partial<Omit<FinancialTransaction, "id" | "teacher_id">>): Promise<FinancialTransaction> => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as FinancialTransaction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
  });
}

export function useDeleteFinancialTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_financial_transaction", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
  });
}
