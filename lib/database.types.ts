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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      client_editor_payment_tiers: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          editor_id: string
          id: string
          max_minutes: number
          min_minutes: number
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          editor_id: string
          id?: string
          max_minutes: number
          min_minutes: number
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          editor_id?: string
          id?: string
          max_minutes?: number
          min_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_editor_payment_tiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_editor_payment_tiers_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "editors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_editor_payment_tiers_pair_fkey"
            columns: ["client_id", "editor_id"]
            isOneToOne: false
            referencedRelation: "client_editors"
            referencedColumns: ["client_id", "editor_id"]
          },
        ]
      }
      client_editors: {
        Row: {
          client_id: string
          created_at: string
          editor_id: string
          flat_amount: number | null
          payment_type:
            | Database["public"]["Enums"]["editor_payment_model"]
            | null
          rate: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          editor_id: string
          flat_amount?: number | null
          payment_type?:
            | Database["public"]["Enums"]["editor_payment_model"]
            | null
          rate?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          editor_id?: string
          flat_amount?: number | null
          payment_type?:
            | Database["public"]["Enums"]["editor_payment_model"]
            | null
          rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_editors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_editors_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "editors"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          minutes_credited: number
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          minutes_credited: number
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          minutes_credited?: number
          note?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agreed_price: number | null
          billing_info: string | null
          color: string
          created_at: string
          docs_url: string | null
          email: string | null
          id: string
          name: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone: string | null
          retainer_discount_pct: number
        }
        Insert: {
          agreed_price?: number | null
          billing_info?: string | null
          color?: string
          created_at?: string
          docs_url?: string | null
          email?: string | null
          id?: string
          name: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          retainer_discount_pct?: number
        }
        Update: {
          agreed_price?: number | null
          billing_info?: string | null
          color?: string
          created_at?: string
          docs_url?: string | null
          email?: string | null
          id?: string
          name?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          retainer_discount_pct?: number
        }
        Relationships: []
      }
      editor_payment_methods: {
        Row: {
          created_at: string
          editor_id: string
          info: string | null
          method_id: string
        }
        Insert: {
          created_at?: string
          editor_id: string
          info?: string | null
          method_id: string
        }
        Update: {
          created_at?: string
          editor_id?: string
          info?: string | null
          method_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "editor_payment_methods_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "editors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editor_payment_methods_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      editor_payment_tiers: {
        Row: {
          amount: number
          created_at: string
          editor_id: string
          id: string
          max_minutes: number
          min_minutes: number
        }
        Insert: {
          amount?: number
          created_at?: string
          editor_id: string
          id?: string
          max_minutes: number
          min_minutes: number
        }
        Update: {
          amount?: number
          created_at?: string
          editor_id?: string
          id?: string
          max_minutes?: number
          min_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "editor_payment_tiers_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "editors"
            referencedColumns: ["id"]
          },
        ]
      }
      editors: {
        Row: {
          created_at: string
          discord_id: string | null
          docs_url: string | null
          email: string | null
          flat_amount: number | null
          id: string
          name: string
          payment_type: Database["public"]["Enums"]["editor_payment_model"]
          phone: string | null
          rate: number | null
        }
        Insert: {
          created_at?: string
          discord_id?: string | null
          docs_url?: string | null
          email?: string | null
          flat_amount?: number | null
          id?: string
          name: string
          payment_type?: Database["public"]["Enums"]["editor_payment_model"]
          phone?: string | null
          rate?: number | null
        }
        Update: {
          created_at?: string
          discord_id?: string | null
          docs_url?: string | null
          email?: string | null
          flat_amount?: number | null
          id?: string
          name?: string
          payment_type?: Database["public"]["Enums"]["editor_payment_model"]
          phone?: string | null
          rate?: number | null
        }
        Relationships: []
      }
      fixed_services: {
        Row: {
          active: boolean
          created_at: string
          id: string
          monthly_cost: number
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          monthly_cost?: number
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          monthly_cost?: number
          name?: string
        }
        Relationships: []
      }
      invoice_projects: {
        Row: {
          created_at: string
          invoice_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          invoice_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          invoice_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_projects_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          id: number
          next_number: number
          sender_address: string
          sender_city: string
          sender_country: string
          sender_email: string
          sender_name: string
          sender_state: string
        }
        Insert: {
          id?: number
          next_number?: number
          sender_address?: string
          sender_city?: string
          sender_country?: string
          sender_email?: string
          sender_name: string
          sender_state?: string
        }
        Update: {
          id?: number
          next_number?: number
          sender_address?: string
          sender_city?: string
          sender_country?: string
          sender_email?: string
          sender_name?: string
          sender_state?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_address: string
          client_country: string
          client_id: string | null
          client_name: string
          created_at: string
          currency_symbol: string
          date: string
          discount_amount: number
          discount_enabled: boolean
          discount_type: string
          discount_value: number
          id: string
          invoice_code: string
          invoice_number: number
          items: Json
          notes: string | null
          pdf_storage_path: string | null
          subtotal: number
          total: number
          upfront_amount: number
          upfront_enabled: boolean
          upfront_percentage: number
        }
        Insert: {
          client_address?: string
          client_country?: string
          client_id?: string | null
          client_name: string
          created_at?: string
          currency_symbol?: string
          date: string
          discount_amount?: number
          discount_enabled?: boolean
          discount_type?: string
          discount_value?: number
          id?: string
          invoice_code: string
          invoice_number: number
          items?: Json
          notes?: string | null
          pdf_storage_path?: string | null
          subtotal?: number
          total?: number
          upfront_amount?: number
          upfront_enabled?: boolean
          upfront_percentage?: number
        }
        Update: {
          client_address?: string
          client_country?: string
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency_symbol?: string
          date?: string
          discount_amount?: number
          discount_enabled?: boolean
          discount_type?: string
          discount_value?: number
          id?: string
          invoice_code?: string
          invoice_number?: number
          items?: Json
          notes?: string | null
          pdf_storage_path?: string | null
          subtotal?: number
          total?: number
          upfront_amount?: number
          upfront_enabled?: boolean
          upfront_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_settlements: {
        Row: {
          party_id: string
          party_type: Database["public"]["Enums"]["settlement_party_type"]
          settled_at: string
          year_month: string
        }
        Insert: {
          party_id: string
          party_type: Database["public"]["Enums"]["settlement_party_type"]
          settled_at?: string
          year_month: string
        }
        Update: {
          party_id?: string
          party_type?: Database["public"]["Enums"]["settlement_party_type"]
          settled_at?: string
          year_month?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_cobros: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          paid_at: string
          project_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          project_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_cobros_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_editor_pagos: {
        Row: {
          amount: number
          created_at: string
          editor_id: string
          id: string
          note: string | null
          paid_at: string
          project_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          editor_id: string
          id?: string
          note?: string | null
          paid_at?: string
          project_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          editor_id?: string
          id?: string
          note?: string | null
          paid_at?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_editor_pagos_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "editors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_editor_pagos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_editors: {
        Row: {
          cost: number | null
          created_at: string
          editor_id: string
          project_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          editor_id: string
          project_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          editor_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_editors_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "editors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_editors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          archived_at: string | null
          client_id: string | null
          client_name: string | null
          cobrado: Database["public"]["Enums"]["cobrado_status"]
          cost: number | null
          created_at: string
          duration_minutes: number | null
          finalized: boolean
          finalized_at: string | null
          id: string
          invoiced: Database["public"]["Enums"]["invoiced_status"]
          pagado: Database["public"]["Enums"]["pagado_status"]
          parent_id: string | null
          phase: Database["public"]["Enums"]["project_phase"]
          position: number
          price: number | null
          project_code: string
          project_type: Database["public"]["Enums"]["project_type"]
          status: Database["public"]["Enums"]["project_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          client_id?: string | null
          client_name?: string | null
          cobrado?: Database["public"]["Enums"]["cobrado_status"]
          cost?: number | null
          created_at?: string
          duration_minutes?: number | null
          finalized?: boolean
          finalized_at?: string | null
          id?: string
          invoiced?: Database["public"]["Enums"]["invoiced_status"]
          pagado?: Database["public"]["Enums"]["pagado_status"]
          parent_id?: string | null
          phase?: Database["public"]["Enums"]["project_phase"]
          position?: number
          price?: number | null
          project_code: string
          project_type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["project_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          client_id?: string | null
          client_name?: string | null
          cobrado?: Database["public"]["Enums"]["cobrado_status"]
          cost?: number | null
          created_at?: string
          duration_minutes?: number | null
          finalized?: boolean
          finalized_at?: string | null
          id?: string
          invoiced?: Database["public"]["Enums"]["invoiced_status"]
          pagado?: Database["public"]["Enums"]["pagado_status"]
          parent_id?: string | null
          phase?: Database["public"]["Enums"]["project_phase"]
          position?: number
          price?: number | null
          project_code?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["project_status"] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_invoice_number: { Args: Record<never, never>; Returns: number }
      slugify: { Args: { input: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      cobrado_status: "si" | "no" | "parcial"
      editor_payment_model: "flat" | "flat_variable" | "por_minuto"
      invoiced_status: "si" | "no" | "parcial"
      pagado_status: "pago_total" | "parcial" | "sin_pagar"
      payment_type: "por_rate" | "mensual" | "por_proyecto"
      project_phase: "editando" | "en_revision" | "por_asignar" | "terminado"
      project_status:
        | "pending"
        | "in_progress"
        | "revising"
        | "done"
        | "invoiced"
      project_type: "long_form" | "short_form" | "other" | "pack"
      settlement_party_type: "client_cobro" | "editor_pago"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      cobrado_status: ["si", "no", "parcial"],
      editor_payment_model: ["flat", "flat_variable", "por_minuto"],
      invoiced_status: ["si", "no", "parcial"],
      pagado_status: ["pago_total", "parcial", "sin_pagar"],
      payment_type: ["por_rate", "mensual", "por_proyecto"],
      project_phase: ["editando", "en_revision", "por_asignar", "terminado"],
      project_status: [
        "pending",
        "in_progress",
        "revising",
        "done",
        "invoiced",
      ],
      project_type: ["long_form", "short_form", "other", "pack"],
      settlement_party_type: ["client_cobro", "editor_pago"],
    },
  },
} as const
