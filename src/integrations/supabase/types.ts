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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          reporter_id: string
          status: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          reporter_id: string
          status?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          reporter_id?: string
          status?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          transaction_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          transaction_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          changed_fields: Json | null
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          profile_id: string
          user_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_fields?: Json | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          profile_id: string
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_fields?: Json | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          profile_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acceptance_terms: boolean | null
          address: string | null
          avs_number: string | null
          company_address: string | null
          company_name: string | null
          country: Database["public"]["Enums"]["country_code"]
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          registration_complete: boolean | null
          siret_uid: string | null
          stripe_customer_id: string | null
          tva_rate: number | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          vat_rate: number | null
          verified: boolean
        }
        Insert: {
          acceptance_terms?: boolean | null
          address?: string | null
          avs_number?: string | null
          company_address?: string | null
          company_name?: string | null
          country: Database["public"]["Enums"]["country_code"]
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          registration_complete?: boolean | null
          siret_uid?: string | null
          stripe_customer_id?: string | null
          tva_rate?: number | null
          updated_at?: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          vat_rate?: number | null
          verified?: boolean
        }
        Update: {
          acceptance_terms?: boolean | null
          address?: string | null
          avs_number?: string | null
          company_address?: string | null
          company_name?: string | null
          country?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          registration_complete?: boolean | null
          siret_uid?: string | null
          stripe_customer_id?: string | null
          tva_rate?: number | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          vat_rate?: number | null
          verified?: boolean
        }
        Relationships: []
      }
      stripe_accounts: {
        Row: {
          account_status: string | null
          charges_enabled: boolean | null
          country: string
          created_at: string
          details_submitted: boolean | null
          id: string
          payouts_enabled: boolean | null
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string | null
          charges_enabled?: boolean | null
          country: string
          created_at?: string
          details_submitted?: boolean | null
          id?: string
          payouts_enabled?: boolean | null
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string | null
          charges_enabled?: boolean | null
          country?: string
          created_at?: string
          details_submitted?: boolean | null
          id?: string
          payouts_enabled?: boolean | null
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          buyer_display_name: string | null
          buyer_id: string | null
          buyer_validated: boolean | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string | null
          dispute_id: string | null
          funds_released: boolean | null
          id: string
          link_expires_at: string | null
          payment_blocked_at: string | null
          payment_deadline: string | null
          payment_method: string | null
          payment_window_hours: number | null
          price: number
          seller_display_name: string | null
          seller_validated: boolean | null
          service_date: string | null
          shared_link_expires_at: string | null
          shared_link_token: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id: string | null
          title: string
          updated_at: string
          user_id: string
          validation_deadline: string | null
        }
        Insert: {
          buyer_display_name?: string | null
          buyer_id?: string | null
          buyer_validated?: boolean | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          dispute_id?: string | null
          funds_released?: boolean | null
          id?: string
          link_expires_at?: string | null
          payment_blocked_at?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          payment_window_hours?: number | null
          price: number
          seller_display_name?: string | null
          seller_validated?: boolean | null
          service_date?: string | null
          shared_link_expires_at?: string | null
          shared_link_token?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          validation_deadline?: string | null
        }
        Update: {
          buyer_display_name?: string | null
          buyer_id?: string | null
          buyer_validated?: boolean | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          dispute_id?: string | null
          funds_released?: boolean | null
          id?: string
          link_expires_at?: string | null
          payment_blocked_at?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          payment_window_hours?: number | null
          price?: number
          seller_display_name?: string | null
          seller_validated?: boolean | null
          service_date?: string | null
          shared_link_expires_at?: string | null
          shared_link_token?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          validation_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_admin_status: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      log_security_event: {
        Args: { details?: Json; event_type: string }
        Returns: undefined
      }
    }
    Enums: {
      country_code: "FR" | "CH"
      currency_code: "EUR" | "CHF"
      transaction_status: "pending" | "paid" | "validated" | "disputed"
      user_type: "individual" | "company" | "independent"
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
      country_code: ["FR", "CH"],
      currency_code: ["EUR", "CHF"],
      transaction_status: ["pending", "paid", "validated", "disputed"],
      user_type: ["individual", "company", "independent"],
    },
  },
} as const
