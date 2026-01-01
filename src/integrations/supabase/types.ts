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
      application_categories: {
        Row: {
          code: string
          country_id: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "application_categories_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      application_subcategories: {
        Row: {
          category_id: string
          code: string
          country_id: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          category_id: string
          code: string
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          code?: string
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "application_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "application_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_subcategories_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          visa_application_id: string | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          visa_application_id?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          visa_application_id?: string | null
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
            columns: ["visa_application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      client_form_data: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          form_data: Json
          id: string
          updated_at: string
          visa_application_id: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          form_data?: Json
          id?: string
          updated_at?: string
          visa_application_id: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          form_data?: Json
          id?: string
          updated_at?: string
          visa_application_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_form_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_form_data_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_form_data_matter_id_fkey"
            columns: ["visa_application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_access: {
        Row: {
          access_token: string
          client_id: string
          company_id: string
          created_at: string
          email: string
          id: string
          is_submitted: boolean
          last_accessed_at: string | null
          submitted_at: string | null
          token_expires_at: string
          updated_at: string
          visa_application_id: string
        }
        Insert: {
          access_token: string
          client_id: string
          company_id: string
          created_at?: string
          email: string
          id?: string
          is_submitted?: boolean
          last_accessed_at?: string | null
          submitted_at?: string | null
          token_expires_at: string
          updated_at?: string
          visa_application_id: string
        }
        Update: {
          access_token?: string
          client_id?: string
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          is_submitted?: boolean
          last_accessed_at?: string | null
          submitted_at?: string | null
          token_expires_at?: string
          updated_at?: string
          visa_application_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_access_matter_id_fkey"
            columns: ["visa_application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_folder_id: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_id: string
          company_name: string | null
          created_at: string
          documents_received_folder_id: string | null
          email: string | null
          first_name: string | null
          folder_status: string
          folder_status_updated_at: string | null
          id: string
          last_name: string | null
          phone: string | null
        }
        Insert: {
          client_folder_id?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_id: string
          company_name?: string | null
          created_at?: string
          documents_received_folder_id?: string | null
          email?: string | null
          first_name?: string | null
          folder_status?: string
          folder_status_updated_at?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
        }
        Update: {
          client_folder_id?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_id?: string
          company_name?: string | null
          created_at?: string
          documents_received_folder_id?: string | null
          email?: string | null
          first_name?: string | null
          folder_status?: string
          folder_status_updated_at?: string | null
          id?: string
          last_name?: string | null
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
          preferred_language: string | null
          save_original_to_documents_received: boolean
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
          preferred_language?: string | null
          save_original_to_documents_received?: boolean
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
          preferred_language?: string | null
          save_original_to_documents_received?: boolean
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
      countries: {
        Row: {
          code: string
          created_at: string | null
          default_language_code: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          default_language_code?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          default_language_code?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "countries_default_language_code_fkey"
            columns: ["default_language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
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
          review_comment: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
          uploaded_by_client: string | null
          visa_application_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document_name: string
          file_path?: string | null
          id?: string
          is_completed?: boolean
          review_comment?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          uploaded_by_client?: string | null
          visa_application_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_name?: string
          file_path?: string | null
          id?: string
          is_completed?: boolean
          review_comment?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          uploaded_by_client?: string | null
          visa_application_id?: string
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
            columns: ["visa_application_id"]
            isOneToOne: false
            referencedRelation: "visa_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_uploaded_by_client_fkey"
            columns: ["uploaded_by_client"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      document_checklist_templates: {
        Row: {
          category: string | null
          company_id: string | null
          country_id: string | null
          created_at: string | null
          document_name: string
          id: string
          is_required: boolean | null
          sort_order: number | null
          visa_subclass: string | null
          visa_type_id: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          country_id?: string | null
          created_at?: string | null
          document_name: string
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
          visa_subclass?: string | null
          visa_type_id?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          country_id?: string | null
          created_at?: string | null
          document_name?: string
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
          visa_subclass?: string | null
          visa_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_checklist_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_templates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_templates_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template_applications: {
        Row: {
          created_at: string
          document_template_id: string
          id: string
          visa_type_id: string
        }
        Insert: {
          created_at?: string
          document_template_id: string
          id?: string
          visa_type_id: string
        }
        Update: {
          created_at?: string
          document_template_id?: string
          id?: string
          visa_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_template_applications_document_template_id_fkey"
            columns: ["document_template_id"]
            isOneToOne: false
            referencedRelation: "document_checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_applications_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
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
          tokens_encrypted: boolean | null
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
          tokens_encrypted?: boolean | null
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
          tokens_encrypted?: boolean | null
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
      languages: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          native_name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          native_name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          native_name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          is_secret: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          is_secret?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          is_secret?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      platform_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          included_fields: string[] | null
          is_active: boolean
          max_retries: number | null
          name: string
          retry_backoff_seconds: number | null
          secret_key: string | null
          timeout_seconds: number | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          included_fields?: string[] | null
          is_active?: boolean
          max_retries?: number | null
          name: string
          retry_backoff_seconds?: number | null
          secret_key?: string | null
          timeout_seconds?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          included_fields?: string[] | null
          is_active?: boolean
          max_retries?: number | null
          name?: string
          retry_backoff_seconds?: number | null
          secret_key?: string | null
          timeout_seconds?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: []
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
      translations: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          language_code: string | null
          translated_text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          field_name: string
          id?: string
          language_code?: string | null
          translated_text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          field_name?: string
          id?: string
          language_code?: string | null
          translated_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      visa_applications: {
        Row: {
          application_name: string
          category_id: string | null
          client_id: string
          company_id: string
          country_id: string | null
          created_at: string
          folder_status: string
          folder_status_updated_at: string | null
          id: string
          status: Database["public"]["Enums"]["matter_status"]
          subcategory_id: string | null
          visa_application_folder_id: string | null
          visa_subclass: string | null
        }
        Insert: {
          application_name: string
          category_id?: string | null
          client_id: string
          company_id: string
          country_id?: string | null
          created_at?: string
          folder_status?: string
          folder_status_updated_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["matter_status"]
          subcategory_id?: string | null
          visa_application_folder_id?: string | null
          visa_subclass?: string | null
        }
        Update: {
          application_name?: string
          category_id?: string | null
          client_id?: string
          company_id?: string
          country_id?: string | null
          created_at?: string
          folder_status?: string
          folder_status_updated_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["matter_status"]
          subcategory_id?: string | null
          visa_application_folder_id?: string | null
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
          {
            foreignKeyName: "visa_applications_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "application_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_applications_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_applications_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "application_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_types: {
        Row: {
          category_id: string | null
          code: string
          country_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          subcategory_id: string | null
        }
        Insert: {
          category_id?: string | null
          code: string
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          subcategory_id?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          subcategory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "application_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_types_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visa_types_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "application_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      webhook_request_logs: {
        Row: {
          client_ip: string | null
          created_at: string
          duration_ms: number | null
          endpoint: string
          error_message: string | null
          id: string
          method: string
          rate_limited: boolean | null
          request_id: string
          status_code: number
          user_agent: string | null
        }
        Insert: {
          client_ip?: string | null
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          error_message?: string | null
          id?: string
          method?: string
          rate_limited?: boolean | null
          request_id: string
          status_code: number
          user_agent?: string | null
        }
        Update: {
          client_ip?: string | null
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          error_message?: string | null
          id?: string
          method?: string
          rate_limited?: boolean | null
          request_id?: string
          status_code?: number
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
        }[]
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      get_client_by_id: {
        Args: { p_client_id: string }
        Returns: {
          client_folder_id: string
          client_type: string
          company_id: string
          company_name: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
        }[]
      }
      get_clients_secure: {
        Args: { p_company_id: string }
        Returns: {
          client_folder_id: string
          client_type: string
          company_id: string
          company_name: string
          created_at: string
          email: string
          first_name: string
          folder_status: string
          id: string
          last_name: string
          phone: string
        }[]
      }
      get_drive_connection_status: {
        Args: { p_company_id: string }
        Returns: {
          company_id: string
          connected_by: string
          connected_email: string
          created_at: string
          id: string
          root_folder_id: string
          root_folder_name: string
          token_expires_at: string
          updated_at: string
        }[]
      }
      get_portal_client_details: {
        Args: { p_token: string }
        Returns: {
          client_type: string
          company_name: string
          first_name: string
          last_name: string
        }[]
      }
      get_portal_documents: {
        Args: { p_token: string }
        Returns: {
          document_name: string
          file_path: string
          id: string
          is_completed: boolean
        }[]
      }
      get_portal_visa_application_details: {
        Args: { p_token: string }
        Returns: {
          application_name: string
          status: string
          visa_application_id: string
          visa_subclass: string
        }[]
      }
      get_webhook_hourly_stats: {
        Args: never
        Returns: {
          avg_duration_ms: number
          client_error_count: number
          endpoint: string
          hour: string
          max_duration_ms: number
          rate_limited_count: number
          server_error_count: number
          success_count: number
          total_requests: number
        }[]
      }
      has_client_access: {
        Args: { _client_id: string; _company_id: string; _user_id: string }
        Returns: boolean
      }
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
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      shares_company_with: {
        Args: { _profile_id: string; _viewer_id: string }
        Returns: boolean
      }
      submit_portal_access: { Args: { p_token: string }; Returns: boolean }
      update_portal_access_timestamp: {
        Args: { p_token: string }
        Returns: boolean
      }
      validate_portal_access_token: {
        Args: { p_token: string }
        Returns: {
          client_id: string
          company_id: string
          email: string
          id: string
          is_submitted: boolean
          last_accessed_at: string
          submitted_at: string
          token_expires_at: string
          visa_application_id: string
        }[]
      }
    }
    Enums: {
      client_type: "personal" | "corporate"
      company_role: "owner" | "admin" | "member" | "guest"
      matter_status: "draft" | "active" | "done"
      niche_type: "migration" | "audit" | "hr"
      platform_role: "super_admin"
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
      platform_role: ["super_admin"],
      subscription_plan: ["free", "basic", "pro", "enterprise"],
    },
  },
} as const
