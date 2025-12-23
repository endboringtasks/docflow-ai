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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      automation_events: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          event_type: string
          id: string
          matter_id: string | null
          payload: Json | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          matter_id?: string | null
          payload?: Json | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          matter_id?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_type: Database["public"]["Enums"]["client_type"]
          company_id: string
          created_at: string
          drive_folder_id: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          client_type?: Database["public"]["Enums"]["client_type"]
          company_id: string
          created_at?: string
          drive_folder_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
        }
        Update: {
          client_type?: Database["public"]["Enums"]["client_type"]
          company_id?: string
          created_at?: string
          drive_folder_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          niche: Database["public"]["Enums"]["niche_type"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          subscription_status: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          niche: Database["public"]["Enums"]["niche_type"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_status?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          niche?: Database["public"]["Enums"]["niche_type"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_status?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_checklist: {
        Row: {
          company_id: string
          created_at: string
          document_name: string
          file_path: string | null
          id: string
          is_completed: boolean
          matter_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document_name: string
          file_path?: string | null
          id?: string
          is_completed?: boolean
          matter_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_name?: string
          file_path?: string | null
          id?: string
          is_completed?: boolean
          matter_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_checklist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_connections: {
        Row: {
          access_token: string
          company_id: string
          connected_by: string
          connected_email: string | null
          created_at: string
          id: string
          refresh_token: string
          root_folder_id: string | null
          root_folder_name: string | null
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          company_id: string
          connected_by: string
          connected_email?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          root_folder_id?: string | null
          root_folder_name?: string | null
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          company_id?: string
          connected_by?: string
          connected_email?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          root_folder_id?: string | null
          root_folder_name?: string | null
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          drive_folder_id: string | null
          id: string
          matter_name: string
          status: Database["public"]["Enums"]["matter_status"]
          visa_subclass: string | null
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          matter_name: string
          status?: Database["public"]["Enums"]["matter_status"]
          visa_subclass?: string | null
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          matter_name?: string
          status?: Database["public"]["Enums"]["matter_status"]
          visa_subclass?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["company_role"]
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["company_role"]
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["company_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_company_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["company_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin_or_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      client_type: "personal" | "corporate"
      company_role: "owner" | "admin" | "member" | "guest"
      matter_status: "draft" | "active" | "done"
      niche_type: "migration" | "audit" | "hr"
      subscription_plan: "free" | "basic" | "pro" | "enterprise"
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
      client_type: ["personal", "corporate"],
      company_role: ["owner", "admin", "member", "guest"],
      matter_status: ["draft", "active", "done"],
      niche_type: ["migration", "audit", "hr"],
      subscription_plan: ["free", "basic", "pro", "enterprise"],
    },
  },
} as const
