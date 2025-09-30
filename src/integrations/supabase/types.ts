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
      activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dispute_messages: {
        Row: {
          created_at: string
          dispute_id: string
          id: string
          message: string
          message_type: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          message: string
          message_type?: string
          sender_id: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          message?: string
          message_type?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_proposals: {
        Row: {
          created_at: string | null
          dispute_id: string
          expires_at: string | null
          id: string
          message: string | null
          proposal_type: string
          proposer_id: string
          refund_percentage: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dispute_id: string
          expires_at?: string | null
          id?: string
          message?: string | null
          proposal_type: string
          proposer_id: string
          refund_percentage?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dispute_id?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          proposal_type?: string
          proposer_id?: string
          refund_percentage?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispute_proposals_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          created_at: string
          dispute_deadline: string | null
          dispute_type: string
          escalated_at: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          dispute_deadline?: string | null
          dispute_type?: string
          escalated_at?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          dispute_deadline?: string | null
          dispute_type?: string
          escalated_at?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_sequences: {
        Row: {
          created_at: string
          current_sequence: number
          id: string
          seller_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          current_sequence?: number
          id?: string
          seller_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          current_sequence?: number
          id?: string
          seller_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          buyer_id: string | null
          currency: string
          generated_at: string
          id: string
          invoice_number: string
          pdf_metadata: Json | null
          seller_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          buyer_id?: string | null
          currency: string
          generated_at?: string
          id?: string
          invoice_number: string
          pdf_metadata?: Json | null
          seller_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          buyer_id?: string | null
          currency?: string
          generated_at?: string
          id?: string
          invoice_number?: string
          pdf_metadata?: Json | null
          seller_id?: string
          transaction_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acceptance_terms: boolean | null
          address: string | null
          avs_number: string | null
          city: string | null
          company_address: string | null
          company_name: string | null
          country: Database["public"]["Enums"]["country_code"]
          created_at: string
          first_name: string | null
          id: string
          is_subject_to_vat: boolean | null
          last_name: string | null
          phone: string | null
          postal_code: string | null
          registration_complete: boolean | null
          siret_uid: string | null
          stripe_customer_id: string | null
          tva_rate: number | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          vat_number: string | null
          vat_rate: number | null
          verified: boolean
        }
        Insert: {
          acceptance_terms?: boolean | null
          address?: string | null
          avs_number?: string | null
          city?: string | null
          company_address?: string | null
          company_name?: string | null
          country: Database["public"]["Enums"]["country_code"]
          created_at?: string
          first_name?: string | null
          id?: string
          is_subject_to_vat?: boolean | null
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          registration_complete?: boolean | null
          siret_uid?: string | null
          stripe_customer_id?: string | null
          tva_rate?: number | null
          updated_at?: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          vat_number?: string | null
          vat_rate?: number | null
          verified?: boolean
        }
        Update: {
          acceptance_terms?: boolean | null
          address?: string | null
          avs_number?: string | null
          city?: string | null
          company_address?: string | null
          company_name?: string | null
          country?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          first_name?: string | null
          id?: string
          is_subject_to_vat?: boolean | null
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          registration_complete?: boolean | null
          siret_uid?: string | null
          stripe_customer_id?: string | null
          tva_rate?: number | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          vat_number?: string | null
          vat_rate?: number | null
          verified?: boolean
        }
        Relationships: []
      }
      stripe_accounts: {
        Row: {
          account_status: string
          charges_enabled: boolean
          country: string
          created_at: string
          details_submitted: boolean
          id: string
          last_status_check: string | null
          onboarding_completed: boolean
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          charges_enabled?: boolean
          country: string
          created_at?: string
          details_submitted?: boolean
          id?: string
          last_status_check?: string | null
          onboarding_completed?: boolean
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          charges_enabled?: boolean
          country?: string
          created_at?: string
          details_submitted?: boolean
          id?: string
          last_status_check?: string | null
          onboarding_completed?: boolean
          payouts_enabled?: boolean
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
          date_change_count: number | null
          date_change_message: string | null
          date_change_requested_at: string | null
          date_change_status: string | null
          description: string | null
          funds_released: boolean | null
          funds_released_at: string | null
          id: string
          payment_blocked_at: string | null
          payment_deadline: string | null
          payment_method: string | null
          price: number
          proposed_service_date: string | null
          seller_display_name: string | null
          seller_validated: boolean | null
          service_date: string | null
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
          date_change_count?: number | null
          date_change_message?: string | null
          date_change_requested_at?: string | null
          date_change_status?: string | null
          description?: string | null
          funds_released?: boolean | null
          funds_released_at?: string | null
          id?: string
          payment_blocked_at?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          price: number
          proposed_service_date?: string | null
          seller_display_name?: string | null
          seller_validated?: boolean | null
          service_date?: string | null
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
          date_change_count?: number | null
          date_change_message?: string | null
          date_change_requested_at?: string | null
          date_change_status?: string | null
          description?: string | null
          funds_released?: boolean | null
          funds_released_at?: string | null
          id?: string
          payment_blocked_at?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          price?: number
          proposed_service_date?: string | null
          seller_display_name?: string | null
          seller_validated?: boolean | null
          service_date?: string | null
          shared_link_token?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          validation_deadline?: string | null
        }
        Relationships: []
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
      get_next_invoice_sequence: {
        Args: { p_seller_id: string; p_year: number }
        Returns: number
      }
      is_admin: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
    }
    Enums: {
      country_code: "FR" | "CH"
      currency_code: "EUR" | "CHF"
      dispute_status:
        | "open"
        | "responded"
        | "resolved"
        | "negotiating"
        | "escalated"
        | "resolved_refund"
        | "resolved_release"
      transaction_status:
        | "pending"
        | "paid"
        | "validated"
        | "disputed"
        | "expired"
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
      dispute_status: [
        "open",
        "responded",
        "resolved",
        "negotiating",
        "escalated",
        "resolved_refund",
        "resolved_release",
      ],
      transaction_status: [
        "pending",
        "paid",
        "validated",
        "disputed",
        "expired",
      ],
      user_type: ["individual", "company", "independent"],
    },
  },
} as const
