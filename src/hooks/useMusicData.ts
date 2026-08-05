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
} from "@/lib/domain";

const LESSON_SELECT = "*, student:students(id, name, photo_url, instrument)";

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
      return (data ?? []) as unknown as LessonWithStudent[];
    },
  });
}

export function useStudentLessons(studentId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-lessons", studentId, user?.id],
    enabled: !!user && !!studentId,
    queryFn: async (): Promise<Lesson[]> => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("student_id", studentId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStudentReports(studentId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-reports", studentId, user?.id],
    enabled: !!user && !!studentId,
    queryFn: async (): Promise<LessonReport[]> => {
      const { data, error } = await supabase
        .from("lesson_reports")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
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

// Sample initial transactions for demonstration
const INITIAL_TRANSACTIONS = [
  {
    id: "tx-1",
    student_name: "Lucas Mendes",
    description: "Mensalidade Agosto - Violão",
    amount: 320,
    type: "receita" as const,
    category: "mensalidade" as const,
    status: "pago" as const,
    payment_method: "pix" as const,
    due_date: "2026-08-05",
    paid_at: "2026-08-02",
  },
  {
    id: "tx-2",
    student_name: "Mariana Costa",
    description: "Mensalidade Agosto - Piano",
    amount: 380,
    type: "receita" as const,
    category: "mensalidade" as const,
    status: "pago" as const,
    payment_method: "pix" as const,
    due_date: "2026-08-10",
    paid_at: "2026-08-04",
  },
  {
    id: "tx-3",
    student_name: "Gabriel Santos",
    description: "Pacote 4 Aulas - Guitarra",
    amount: 400,
    type: "receita" as const,
    category: "pacote" as const,
    status: "pendente" as const,
    payment_method: "cartao" as const,
    due_date: "2026-08-12",
  },
  {
    id: "tx-4",
    student_name: "Beatriz Lima",
    description: "Mensalidade Julho - Canto (Atrasado)",
    amount: 350,
    type: "receita" as const,
    category: "mensalidade" as const,
    status: "atrasado" as const,
    payment_method: "pix" as const,
    due_date: "2026-07-28",
  },
  {
    id: "tx-5",
    description: "Manutenção de Instrumentos & Cabos",
    amount: 150,
    type: "despesa" as const,
    category: "equipamento" as const,
    status: "pago" as const,
    payment_method: "pix" as const,
    due_date: "2026-08-01",
    paid_at: "2026-08-01",
  },
];

function readTransactions() {
  const stored = localStorage.getItem("maestro_transactions");
  if (!stored) return INITIAL_TRANSACTIONS;
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_TRANSACTIONS;
  }
}
export function useFinancialTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financial-transactions", user?.id],
    queryFn: () => readTransactions(),
  });
}

export function useAddFinancialTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: Omit<FinancialTransaction, "id">) => {
      const current = readTransactions();

      const newTx = { ...tx, id: `tx-${Date.now()}` };
      const updated = [newTx, ...current];
      localStorage.setItem("maestro_transactions", JSON.stringify(updated));
      return newTx;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
  });
}

export function useUpdateFinancialTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: { id: string; status?: string; paid_at?: string | null }) => {
      const current = readTransactions();
      const updated = current.map((t: { id: string }) => (t.id === tx.id ? { ...t, ...tx } : t));
      localStorage.setItem("maestro_transactions", JSON.stringify(updated));
      return updated;
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
      const current = readTransactions();
      const updated = current.filter((t: { id: string }) => t.id !== id);
      localStorage.setItem("maestro_transactions", JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
  });
}
