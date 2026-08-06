export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          teacher_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          teacher_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          teacher_id?: string
          weekday?: number
        }
        Relationships: []
      }
      billing_suppressions: {
        Row: {
          created_at: string
          id: string
          source_key: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_key: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_key?: string
          teacher_id?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          teacher_id?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string
          competence_date: string
          created_at: string
          description: string
          due_date: string
          id: string
          lesson_id: string | null
          origin: string
          paid_at: string | null
          payment_method: string
          source_key: string | null
          status: string
          student_id: string | null
          student_name: string | null
          student_program_id: string | null
          teacher_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          competence_date?: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          lesson_id?: string | null
          origin?: string
          paid_at?: string | null
          payment_method?: string
          source_key?: string | null
          status?: string
          student_id?: string | null
          student_name?: string | null
          student_program_id?: string | null
          teacher_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          competence_date?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          lesson_id?: string | null
          origin?: string
          paid_at?: string | null
          payment_method?: string
          source_key?: string | null
          status?: string
          student_id?: string | null
          student_name?: string | null
          student_program_id?: string | null
          teacher_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_student_program_id_fkey"
            columns: ["student_program_id"]
            isOneToOne: false
            referencedRelation: "student_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_participants: {
        Row: {
          attendance: string
          billing_amount: number | null
          billing_mode: string
          created_at: string
          id: string
          lesson_id: string
          notes: string | null
          payment_method: string | null
          student_id: string
          student_program_id: string | null
          teacher_id: string
        }
        Insert: {
          attendance?: string
          billing_amount?: number | null
          billing_mode?: string
          created_at?: string
          id?: string
          lesson_id: string
          notes?: string | null
          payment_method?: string | null
          student_id: string
          student_program_id?: string | null
          teacher_id: string
        }
        Update: {
          attendance?: string
          billing_amount?: number | null
          billing_mode?: string
          created_at?: string
          id?: string
          lesson_id?: string
          notes?: string | null
          payment_method?: string | null
          student_id?: string
          student_program_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_participants_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_participants_student_program_id_fkey"
            columns: ["student_program_id"]
            isOneToOne: false
            referencedRelation: "student_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reports: {
        Row: {
          content: string | null
          created_at: string
          exercises: string | null
          id: string
          lesson_id: string
          notes: string | null
          scope: string
          student_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          exercises?: string | null
          id?: string
          lesson_id: string
          notes?: string | null
          scope?: string
          student_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          exercises?: string | null
          id?: string
          lesson_id?: string
          notes?: string | null
          scope?: string
          student_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reports_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_reports_participant_fkey"
            columns: ["lesson_id", "student_id"]
            isOneToOne: false
            referencedRelation: "lesson_participants"
            referencedColumns: ["lesson_id", "student_id"]
          },
          {
            foreignKeyName: "lesson_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          location: string | null
          notes: string | null
          starts_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          student_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          location?: string | null
          notes?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["lesson_status"]
          student_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          location?: string | null
          notes?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          student_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["material_kind"]
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          student_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["material_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          student_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["material_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          student_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          theme: string
          timezone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          theme?: string
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          theme?: string
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      student_programs: {
        Row: {
          active: boolean
          amount: number | null
          auto_billing: boolean
          billing_type: string
          created_at: string
          due_day: number | null
          goal: string | null
          id: string
          instrument: string
          is_primary: boolean
          level: string | null
          package_lessons: number | null
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number | null
          auto_billing?: boolean
          billing_type?: string
          created_at?: string
          due_day?: number | null
          goal?: string | null
          id?: string
          instrument: string
          is_primary?: boolean
          level?: string | null
          package_lessons?: number | null
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number | null
          auto_billing?: boolean
          billing_type?: string
          created_at?: string
          due_day?: number | null
          goal?: string | null
          id?: string
          instrument?: string
          is_primary?: boolean
          level?: string | null
          package_lessons?: number | null
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_programs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          default_duration: number
          default_lesson_type: Database["public"]["Enums"]["lesson_type"]
          default_location: string | null
          default_time: string | null
          default_weekday: number | null
          email: string | null
          goal: string | null
          id: string
          instrument: string
          name: string
          notes: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["student_status"]
          teacher_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          default_duration?: number
          default_lesson_type?: Database["public"]["Enums"]["lesson_type"]
          default_location?: string | null
          default_time?: string | null
          default_weekday?: number | null
          email?: string | null
          goal?: string | null
          id?: string
          instrument?: string
          name: string
          notes?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          teacher_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          default_duration?: number
          default_lesson_type?: Database["public"]["Enums"]["lesson_type"]
          default_location?: string | null
          default_time?: string | null
          default_weekday?: number | null
          email?: string | null
          goal?: string | null
          id?: string
          instrument?: string
          name?: string
          notes?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          teacher_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_financial_transaction: {
        Args: { p_id: string }
        Returns: undefined
      }
      generate_monthly_charges: {
        Args: { p_competence?: string }
        Returns: number
      }
      save_lesson_assessments: {
        Args: { p_general: Json; p_individuals: Json; p_lesson_id: string }
        Returns: undefined
      }
      save_lesson_with_participants: {
        Args: { p_lesson: Json; p_lesson_id: string; p_participants: Json }
        Returns: string
      }
      save_student_with_programs: {
        Args: { p_programs: Json; p_student: Json }
        Returns: string
      }
    }
    Enums: {
      lesson_status: "agendada" | "realizada" | "cancelada" | "remarcada"
      lesson_type: "presencial" | "online" | "experimental" | "reposicao"
      material_kind: "pdf" | "imagem" | "video" | "audio" | "outro"
      student_status: "ativo" | "pausado" | "inativo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      lesson_status: ["agendada", "realizada", "cancelada", "remarcada"],
      lesson_type: ["presencial", "online", "experimental", "reposicao"],
      material_kind: ["pdf", "imagem", "video", "audio", "outro"],
      student_status: ["ativo", "pausado", "inativo"],
    },
  },
} as const
