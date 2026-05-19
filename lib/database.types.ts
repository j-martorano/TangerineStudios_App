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
      client_editors: {
        Row: {
          client_id: string
          created_at: string
          editor_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          editor_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          editor_id?: string
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
      clients: {
        Row: {
          agreed_price: number | null
          balance: number
          billing_info: string | null
          color: string
          created_at: string
          docs_url: string | null
          email: string | null
          id: string
          monthly_fee: number | null
          name: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone: string | null
        }
        Insert: {
          agreed_price?: number | null
          balance?: number
          billing_info?: string | null
          color?: string
          created_at?: string
          docs_url?: string | null
          email?: string | null
          id?: string
          monthly_fee?: number | null
          name: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
        }
        Update: {
          agreed_price?: number | null
          balance?: number
          billing_info?: string | null
          color?: string
          created_at?: string
          docs_url?: string | null
          email?: string | null
          id?: string
          monthly_fee?: number | null
          name?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
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
      editors: {
        Row: {
          created_at: string
          discord_id: string | null
          docs_url: string | null
          email: string | null
          id: string
          monthly_fee: number | null
          name: string
          payment_type: Database["public"]["Enums"]["editor_payment_type"]
          phone: string | null
          rate: number | null
        }
        Insert: {
          created_at?: string
          discord_id?: string | null
          docs_url?: string | null
          email?: string | null
          id?: string
          monthly_fee?: number | null
          name: string
          payment_type?: Database["public"]["Enums"]["editor_payment_type"]
          phone?: string | null
          rate?: number | null
        }
        Update: {
          created_at?: string
          discord_id?: string | null
          docs_url?: string | null
          email?: string | null
          id?: string
          monthly_fee?: number | null
          name?: string
          payment_type?: Database["public"]["Enums"]["editor_payment_type"]
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
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_editors: {
        Row: {
          cost: number | null
          created_at: string
          editor_id: string
          project_id: string
          role: Database["public"]["Enums"]["editor_role"]
        }
        Insert: {
          cost?: number | null
          created_at?: string
          editor_id: string
          project_id: string
          role: Database["public"]["Enums"]["editor_role"]
        }
        Update: {
          cost?: number | null
          created_at?: string
          editor_id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["editor_role"]
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
          client_id: string | null
          client_name: string | null
          cobrado: Database["public"]["Enums"]["cobrado_status"]
          cost: number | null
          created_at: string
          duration_minutes: number | null
          id: string
          invoiced: Database["public"]["Enums"]["invoiced_status"]
          pagado: Database["public"]["Enums"]["pagado_status"]
          phase: Database["public"]["Enums"]["project_phase"]
          position: number
          price: number | null
          project_code: string
          status: Database["public"]["Enums"]["project_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          cobrado?: Database["public"]["Enums"]["cobrado_status"]
          cost?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          invoiced?: Database["public"]["Enums"]["invoiced_status"]
          pagado?: Database["public"]["Enums"]["pagado_status"]
          phase?: Database["public"]["Enums"]["project_phase"]
          position?: number
          price?: number | null
          project_code: string
          status?: Database["public"]["Enums"]["project_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          cobrado?: Database["public"]["Enums"]["cobrado_status"]
          cost?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          invoiced?: Database["public"]["Enums"]["invoiced_status"]
          pagado?: Database["public"]["Enums"]["pagado_status"]
          phase?: Database["public"]["Enums"]["project_phase"]
          position?: number
          price?: number | null
          project_code?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      slugify: { Args: { input: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      cobrado_status: "si" | "no" | "parcial"
      editor_payment_type: "por_rate" | "mensual"
      editor_role: "primary" | "secondary"
      invoiced_status: "si" | "no" | "parcial"
      pagado_status: "pago_total" | "parcial" | "sin_pagar"
      payment_type: "por_rate" | "mensual" | "por_proyecto"
      project_phase: "editando" | "por_asignar" | "terminado"
      project_status:
        | "pending"
        | "in_progress"
        | "revising"
        | "done"
        | "invoiced"
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
      editor_payment_type: ["por_rate", "mensual"],
      editor_role: ["primary", "secondary"],
      invoiced_status: ["si", "no", "parcial"],
      pagado_status: ["pago_total", "parcial", "sin_pagar"],
      payment_type: ["por_rate", "mensual", "por_proyecto"],
      project_phase: ["editando", "por_asignar", "terminado"],
      project_status: [
        "pending",
        "in_progress",
        "revising",
        "done",
        "invoiced",
      ],
      settlement_party_type: ["client_cobro", "editor_pago"],
    },
  },
} as const
