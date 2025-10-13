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
      admin_dispute_notes: {
        Row: {
          admin_user_id: string
          created_at: string
          dispute_id: string
          id: string
          notes: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          dispute_id: string
          id?: string
          notes: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          dispute_id?: string
          id?: string
          notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_dispute_notes_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_role_audit_log: {
        Row: {
          changed_by_user_id: string
          created_at: string
          id: string
          new_role: string | null
          old_role: string | null
          operation: string
          target_user_id: string
        }
        Insert: {
          changed_by_user_id: string
          created_at?: string
          id?: string
          new_role?: string | null
          old_role?: string | null
          operation: string
          target_user_id: string
        }
        Update: {
          changed_by_user_id?: string
          created_at?: string
          id?: string
          new_role?: string | null
          old_role?: string | null
          operation?: string
          target_user_id?: string
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
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          message: string
          message_type?: string
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          message?: string
          message_type?: string
          recipient_id?: string | null
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
          admin_created: boolean | null
          buyer_validated: boolean | null
          created_at: string | null
          dispute_id: string
          expires_at: string | null
          id: string
          message: string | null
          proposal_type: string
          proposer_id: string
          refund_percentage: number | null
          rejected_by: string | null
          requires_both_parties: boolean | null
          seller_validated: boolean | null
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_created?: boolean | null
          buyer_validated?: boolean | null
          created_at?: string | null
          dispute_id: string
          expires_at?: string | null
          id?: string
          message?: string | null
          proposal_type: string
          proposer_id: string
          refund_percentage?: number | null
          rejected_by?: string | null
          requires_both_parties?: boolean | null
          seller_validated?: boolean | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_created?: boolean | null
          buyer_validated?: boolean | null
          created_at?: string | null
          dispute_id?: string
          expires_at?: string | null
          id?: string
          message?: string | null
          proposal_type?: string
          proposer_id?: string
          refund_percentage?: number | null
          rejected_by?: string | null
          requires_both_parties?: boolean | null
          seller_validated?: boolean | null
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
          archived_by_buyer: boolean
          archived_by_seller: boolean
          buyer_archived_at: string | null
          created_at: string
          dispute_deadline: string | null
          dispute_type: string
          escalated_at: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          seller_archived_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          archived_by_buyer?: boolean
          archived_by_seller?: boolean
          buyer_archived_at?: string | null
          created_at?: string
          dispute_deadline?: string | null
          dispute_type?: string
          escalated_at?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          seller_archived_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          archived_by_buyer?: boolean
          archived_by_seller?: boolean
          buyer_archived_at?: string | null
          created_at?: string
          dispute_deadline?: string | null
          dispute_type?: string
          escalated_at?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          seller_archived_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
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
      message_reads: {
        Row: {
          created_at: string
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "transaction_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_access_logs: {
        Row: {
          access_type: string
          accessed_by_user_id: string
          accessed_fields: string[] | null
          accessed_profile_id: string
          created_at: string
          id: string
        }
        Insert: {
          access_type: string
          accessed_by_user_id: string
          accessed_fields?: string[] | null
          accessed_profile_id: string
          created_at?: string
          id?: string
        }
        Update: {
          access_type?: string
          accessed_by_user_id?: string
          accessed_fields?: string[] | null
          accessed_profile_id?: string
          created_at?: string
          id?: string
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
      security_audit_log: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          operation: string
          suspicious_pattern: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          operation: string
          suspicious_pattern?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          operation?: string
          suspicious_pattern?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shared_link_access_logs: {
        Row: {
          accessed_at: string | null
          error_reason: string | null
          id: string
          ip_address: string | null
          success: boolean
          token_used: string
          transaction_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string | null
          error_reason?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          token_used: string
          transaction_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string | null
          error_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          token_used?: string
          transaction_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_link_access_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_account_access_audit: {
        Row: {
          access_type: string
          accessed_at: string
          accessed_by_user_id: string
          accessed_user_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_at?: string
          accessed_by_user_id: string
          accessed_user_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string
          accessed_by_user_id?: string
          accessed_user_id?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
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
      transaction_access_attempts: {
        Row: {
          created_at: string | null
          error_reason: string | null
          id: string
          ip_address: string | null
          success: boolean
          token: string
          transaction_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          error_reason?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          token: string
          transaction_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          error_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          token?: string
          transaction_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      transaction_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
          proposed_service_end_date: string | null
          refund_status: string
          renewal_count: number
          seller_display_name: string | null
          seller_validated: boolean | null
          seller_validation_deadline: string | null
          service_date: string | null
          service_end_date: string | null
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
          proposed_service_end_date?: string | null
          refund_status?: string
          renewal_count?: number
          seller_display_name?: string | null
          seller_validated?: boolean | null
          seller_validation_deadline?: string | null
          service_date?: string | null
          service_end_date?: string | null
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
          proposed_service_end_date?: string | null
          refund_status?: string
          renewal_count?: number
          seller_display_name?: string | null
          seller_validated?: boolean | null
          seller_validation_deadline?: string | null
          service_date?: string | null
          service_end_date?: string | null
          shared_link_expires_at?: string | null
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_transaction_counterparties: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      can_access_full_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      check_admin_role: {
        Args: { _user_id: string }
        Returns: boolean
      }
      check_token_abuse_secure: {
        Args: { check_ip?: string; check_token: string }
        Returns: boolean
      }
      detect_suspicious_pattern: {
        Args: { p_operation: string; p_table_name: string; p_user_id?: string }
        Returns: boolean
      }
      generate_secure_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_buyer_invoice_data: {
        Args: { p_buyer_id: string; p_requesting_user_id: string }
        Returns: {
          address: string
          avs_number: string
          city: string
          company_address: string
          company_name: string
          country: Database["public"]["Enums"]["country_code"]
          first_name: string
          is_subject_to_vat: boolean
          last_name: string
          phone: string
          postal_code: string
          siret_uid: string
          tva_rate: number
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          vat_number: string
          vat_rate: number
        }[]
      }
      get_counterparty_safe_profile: {
        Args: { profile_user_id: string }
        Returns: {
          company_name: string
          country: Database["public"]["Enums"]["country_code"]
          first_name: string
          last_name: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          verified: boolean
        }[]
      }
      get_counterparty_stripe_status: {
        Args: { stripe_user_id: string }
        Returns: {
          has_active_account: boolean
        }[]
      }
      get_current_user_admin_status: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_next_invoice_sequence: {
        Args: { p_seller_id: string; p_year: number }
        Returns: number
      }
      get_safe_profile: {
        Args: { profile_user_id: string }
        Returns: {
          company_name: string
          country: Database["public"]["Enums"]["country_code"]
          first_name: string
          last_name: string
          registration_complete: boolean
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          verified: boolean
        }[]
      }
      get_seller_invoice_data: {
        Args: { p_requesting_user_id: string; p_seller_id: string }
        Returns: {
          address: string
          avs_number: string
          city: string
          company_address: string
          company_name: string
          country: Database["public"]["Enums"]["country_code"]
          first_name: string
          is_subject_to_vat: boolean
          last_name: string
          postal_code: string
          siret_uid: string
          tva_rate: number
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          vat_number: string
          vat_rate: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      is_admin_secure: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      log_admin_profile_access: {
        Args: { accessed_user_id: string; admin_user_id: string }
        Returns: boolean
      }
      log_stripe_admin_access: {
        Args: { accessed_user_id: string; admin_user_id: string }
        Returns: boolean
      }
      log_transaction_access: {
        Args: {
          p_error_reason?: string
          p_ip_address?: string
          p_success: boolean
          p_token: string
          p_transaction_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      purge_old_activity_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      scheduled_security_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      validate_shared_link_secure: {
        Args: {
          p_ip_address?: string
          p_token: string
          p_transaction_id: string
        }
        Returns: boolean
      }
      validate_shared_link_token: {
        Args: { p_token: string; p_transaction_id: string }
        Returns: boolean
      }
      verify_token_security: {
        Args: Record<PropertyKey, never>
        Returns: {
          has_expiry: boolean
          is_expired: boolean
          security_score: number
          token_length: number
          transaction_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin"
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
      app_role: ["admin", "moderator", "user", "super_admin"],
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
