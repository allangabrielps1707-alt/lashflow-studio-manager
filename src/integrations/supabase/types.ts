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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_events: {
        Row: {
          appointment_id: string
          created_at: string
          event_type: string
          from_starts_at: string | null
          id: string
          note: string | null
          to_starts_at: string | null
          user_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          event_type: string
          from_starts_at?: string | null
          id?: string
          note?: string | null
          to_starts_at?: string | null
          user_id?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          event_type?: string
          from_starts_at?: string | null
          id?: string
          note?: string | null
          to_starts_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          amount_paid: number
          balance: number | null
          cancel_reason: string | null
          client_id: string
          created_at: string
          deposit: number
          duration_minutes: number
          id: string
          notes: string | null
          payment_method: string | null
          price: number
          procedure_id: string | null
          procedure_name: string
          reschedule_count: number
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          balance?: number | null
          cancel_reason?: string | null
          client_id: string
          created_at?: string
          deposit?: number
          duration_minutes?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          price?: number
          procedure_id?: string | null
          procedure_name: string
          reschedule_count?: number
          starts_at: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_paid?: number
          balance?: number | null
          cancel_reason?: string | null
          client_id?: string
          created_at?: string
          deposit?: number
          duration_minutes?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          price?: number
          procedure_id?: string | null
          procedure_name?: string
          reschedule_count?: number
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      client_photos: {
        Row: {
          appointment_id: string | null
          caption: string | null
          client_id: string
          created_at: string
          id: string
          kind: string
          storage_path: string
          taken_on: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          caption?: string | null
          client_id: string
          created_at?: string
          id?: string
          kind?: string
          storage_path: string
          taken_on?: string
          user_id?: string
        }
        Update: {
          appointment_id?: string | null
          caption?: string | null
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          storage_path?: string
          taken_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_photos_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_photos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          allergies: string | null
          birthday: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          allergies?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      procedures: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          lash_model: string | null
          maintenance_days: number | null
          name: string
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          lash_model?: string | null
          maintenance_days?: number | null
          name: string
          price?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          lash_model?: string | null
          maintenance_days?: number | null
          name?: string
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          expires_on: string | null
          id: string
          min_quantity: number
          name: string
          notes: string | null
          quantity: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          min_quantity?: number
          name: string
          notes?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          min_quantity?: number
          name?: string
          notes?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          created_at: string
          full_name: string | null
          id: string
          msg_confirmation: string
          msg_maintenance: string
          msg_reminder: string
          msg_thanks: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          msg_confirmation?: string
          msg_maintenance?: string
          msg_reminder?: string
          msg_thanks?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          msg_confirmation?: string
          msg_maintenance?: string
          msg_reminder?: string
          msg_thanks?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          note: string | null
          occurred_on: string
          product_id: string
          quantity: number
          total_cost: number | null
          transaction_id: string | null
          type: string
          unit_cost: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          occurred_on?: string
          product_id: string
          quantity: number
          total_cost?: number | null
          transaction_id?: string | null
          type: string
          unit_cost?: number | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          occurred_on?: string
          product_id?: string
          quantity?: number
          total_cost?: number | null
          transaction_id?: string | null
          type?: string
          unit_cost?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          occurred_on: string
          payment_method: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_on?: string
          payment_method?: string | null
          type: string
          user_id?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_on?: string
          payment_method?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recalc_appointment_paid: { Args: { _appt: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
