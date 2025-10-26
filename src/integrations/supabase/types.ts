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
      adyen_payout_accounts: {
        Row: {
          account_holder_name: string
          bank_name: string | null
          bic: string | null
          country: string
          created_at: string
          iban: string
          id: string
          is_default: boolean | null
          metadata: Json | null
          updated_at: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder_name: string
          bank_name?: string | null
          bic?: string | null
          country: string
          created_at?: string
          iban: string
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder_name?: string
          bank_name?: string | null
          bic?: string | null
          country?: string
          created_at?: string
          iban?: string
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      adyen_payouts: {
        Row: {
          account_holder_name: string
          admin_notes: string | null
          bank_reference: string | null
          batch_reference: string | null
          bic: string | null
          completed_at: string | null
          created_at: string
          currency: string
          estimated_processor_fees: number
          gross_amount: number
          iban_destination: string
          id: string
          metadata: Json | null
          net_platform_revenue: number
          platform_commission: number
          seller_amount: number
          seller_id: string
          sent_at: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          account_holder_name: string
          admin_notes?: string | null
          bank_reference?: string | null
          batch_reference?: string | null
          bic?: string | null
          completed_at?: string | null
          created_at?: string
          currency: string
          estimated_processor_fees: number
          gross_amount: number
          iban_destination: string
          id?: string
          metadata?: Json | null
          net_platform_revenue: number
          platform_commission: number
          seller_amount: number
          seller_id: string
          sent_at?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          account_holder_name?: string
          admin_notes?: string | null
          bank_reference?: string | null
          batch_reference?: string | null
          bic?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          estimated_processor_fees?: number
          gross_amount?: number
          iban_destination?: string
          id?: string
          metadata?: Json | null
          net_platform_revenue?: number
          platform_commission?: number
          seller_amount?: number
          seller_id?: string
          sent_at?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adyen_payouts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      aml_checks: {
        Row: {
          check_type: string
          checked_by: string | null
          created_at: string
          flags: Json | null
          id: string
          notes: string | null
          provider: string | null
          provider_response: Json | null
          risk_score: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          check_type: string
          checked_by?: string | null
          created_at?: string
          flags?: Json | null
          id?: string
          notes?: string | null
          provider?: string | null
          provider_response?: Json | null
          risk_score?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          check_type?: string
          checked_by?: string | null
          created_at?: string
          flags?: Json | null
          id?: string
          notes?: string | null
          provider?: string | null
          provider_response?: Json | null
          risk_score?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          admin_id: string | null
          buyer_id: string | null
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string
          dispute_id: string | null
          id: string
          quote_id: string | null
          seller_id: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          buyer_id?: string | null
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          dispute_id?: string | null
          id?: string
          quote_id?: string | null
          seller_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          buyer_id?: string | null
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          dispute_id?: string | null
          id?: string
          quote_id?: string | null
          seller_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
          conversation_id: string
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
          conversation_id: string
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
          conversation_id?: string
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
            foreignKeyName: "disputes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          feature_key: string
          id: string
          metadata: Json | null
          rollout_percentage: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          feature_key: string
          id?: string
          metadata?: Json | null
          rollout_percentage?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          feature_key?: string
          id?: string
          metadata?: Json | null
          rollout_percentage?: number | null
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
      kyc_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          notes: string | null
          updated_at: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      kyc_status: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          notes: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
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
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message: string
          message_type: string
          metadata: Json | null
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message: string
          message_type?: string
          metadata?: Json | null
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          metadata?: Json | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
          company_logo_url: string | null
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
          company_logo_url?: string | null
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
          company_logo_url?: string | null
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
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          subscription: Json
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          subscription: Json
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          subscription?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          archived_by_client: boolean | null
          archived_by_seller: boolean | null
          client_archived_at: string | null
          client_email: string | null
          client_last_viewed_at: string | null
          client_name: string | null
          client_user_id: string | null
          conversation_id: string | null
          converted_transaction_id: string | null
          created_at: string
          currency: string
          description: string | null
          discount_percentage: number | null
          fee_ratio_client: number | null
          id: string
          items: Json
          secure_token: string
          seller_archived_at: string | null
          seller_id: string
          service_date: string | null
          service_end_date: string | null
          status: string
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          title: string
          token_expires_at: string
          total_amount: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          archived_by_client?: boolean | null
          archived_by_seller?: boolean | null
          client_archived_at?: string | null
          client_email?: string | null
          client_last_viewed_at?: string | null
          client_name?: string | null
          client_user_id?: string | null
          conversation_id?: string | null
          converted_transaction_id?: string | null
          created_at?: string
          currency: string
          description?: string | null
          discount_percentage?: number | null
          fee_ratio_client?: number | null
          id?: string
          items?: Json
          secure_token?: string
          seller_archived_at?: string | null
          seller_id: string
          service_date?: string | null
          service_end_date?: string | null
          status?: string
          subtotal: number
          tax_amount?: number | null
          tax_rate?: number | null
          title: string
          token_expires_at?: string
          total_amount: number
          updated_at?: string
          valid_until?: string
        }
        Update: {
          archived_by_client?: boolean | null
          archived_by_seller?: boolean | null
          client_archived_at?: string | null
          client_email?: string | null
          client_last_viewed_at?: string | null
          client_name?: string | null
          client_user_id?: string | null
          conversation_id?: string | null
          converted_transaction_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          discount_percentage?: number | null
          fee_ratio_client?: number | null
          id?: string
          items?: Json
          secure_token?: string
          seller_archived_at?: string | null
          seller_id?: string
          service_date?: string | null
          service_end_date?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          title?: string
          token_expires_at?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_transaction_id_fkey"
            columns: ["converted_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rate_limit_attempts: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          identifier: string
          identifier_type: string
          updated_at: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          identifier: string
          identifier_type: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          identifier?: string
          identifier_type?: string
          updated_at?: string
          window_start?: string
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
      transactions: {
        Row: {
          adyen_psp_reference: string | null
          buyer_display_name: string | null
          buyer_id: string | null
          buyer_validated: boolean | null
          client_email: string | null
          conversation_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          date_change_count: number | null
          date_change_message: string | null
          date_change_requested_at: string | null
          date_change_status: string | null
          description: string | null
          fee_ratio_client: number | null
          funds_released: boolean | null
          funds_released_at: string | null
          id: string
          items: Json | null
          last_reminder_sent_at: string | null
          payment_blocked_at: string | null
          payment_deadline: string | null
          payment_deadline_hours: number | null
          payment_method: string | null
          payment_provider: string | null
          price: number
          proposed_service_date: string | null
          proposed_service_end_date: string | null
          refund_percentage: number | null
          refund_status: string
          reminder_checkpoints: Json | null
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
          adyen_psp_reference?: string | null
          buyer_display_name?: string | null
          buyer_id?: string | null
          buyer_validated?: boolean | null
          client_email?: string | null
          conversation_id?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          date_change_count?: number | null
          date_change_message?: string | null
          date_change_requested_at?: string | null
          date_change_status?: string | null
          description?: string | null
          fee_ratio_client?: number | null
          funds_released?: boolean | null
          funds_released_at?: string | null
          id?: string
          items?: Json | null
          last_reminder_sent_at?: string | null
          payment_blocked_at?: string | null
          payment_deadline?: string | null
          payment_deadline_hours?: number | null
          payment_method?: string | null
          payment_provider?: string | null
          price: number
          proposed_service_date?: string | null
          proposed_service_end_date?: string | null
          refund_percentage?: number | null
          refund_status?: string
          reminder_checkpoints?: Json | null
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
          adyen_psp_reference?: string | null
          buyer_display_name?: string | null
          buyer_id?: string | null
          buyer_validated?: boolean | null
          client_email?: string | null
          conversation_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          date_change_count?: number | null
          date_change_message?: string | null
          date_change_requested_at?: string | null
          date_change_status?: string | null
          description?: string | null
          fee_ratio_client?: number | null
          funds_released?: boolean | null
          funds_released_at?: string | null
          id?: string
          items?: Json | null
          last_reminder_sent_at?: string | null
          payment_blocked_at?: string | null
          payment_deadline?: string | null
          payment_deadline_hours?: number | null
          payment_method?: string | null
          payment_provider?: string | null
          price?: number
          proposed_service_date?: string | null
          proposed_service_end_date?: string | null
          refund_percentage?: number | null
          refund_status?: string
          reminder_checkpoints?: Json | null
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
        Relationships: [
          {
            foreignKeyName: "transactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_events: {
        Row: {
          created_at: string
          data: Json | null
          event_id: string
          event_type: string
          id: string
          processed_at: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_id: string
          event_type: string
          id?: string
          processed_at?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_id?: string
          event_type?: string
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      dispute_system_health: {
        Row: {
          count: string | null
          metric: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      are_transaction_counterparties: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      assign_self_as_buyer: {
        Args: { p_token: string; p_transaction_id: string }
        Returns: boolean
      }
      can_access_full_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      can_create_transaction: { Args: { p_user_id: string }; Returns: boolean }
      check_admin_role: { Args: { _user_id: string }; Returns: boolean }
      check_token_abuse_secure: {
        Args: { check_ip?: string; check_token: string }
        Returns: boolean
      }
      cleanup_old_logs: { Args: never; Returns: undefined }
      cleanup_old_push_subscriptions: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_webhook_events: { Args: never; Returns: undefined }
      create_escalated_dispute_conversations: {
        Args: { p_admin_id: string; p_dispute_id: string }
        Returns: {
          buyer_conversation_id: string
          seller_conversation_id: string
        }[]
      }
      detect_suspicious_pattern: {
        Args: { p_operation: string; p_table_name: string; p_user_id?: string }
        Returns: boolean
      }
      generate_secure_token: { Args: never; Returns: string }
      get_adyen_accounting_summary: {
        Args: never
        Returns: {
          pending_payouts_amount: number
          pending_payouts_count: number
          total_captured: number
          total_estimated_fees: number
          total_net_revenue: number
          total_owed_to_sellers: number
          total_platform_commission: number
        }[]
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
      get_current_user_admin_status: { Args: never; Returns: boolean }
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
      get_transaction_by_token_safe: {
        Args: { p_token: string }
        Returns: {
          buyer_display_name: string
          buyer_id: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          id: string
          is_expired: boolean
          payment_deadline: string
          price: number
          seller_display_name: string
          service_date: string
          service_end_date: string
          shared_link_expires_at: string
          status: Database["public"]["Enums"]["transaction_status"]
          title: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { check_user_id?: string }; Returns: boolean }
      is_admin_secure: { Args: { check_user_id?: string }; Returns: boolean }
      is_feature_enabled: { Args: { flag_key: string }; Returns: boolean }
      is_super_admin: { Args: { check_user_id?: string }; Returns: boolean }
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
      purge_old_activity_logs: { Args: never; Returns: undefined }
      scheduled_security_cleanup: { Args: never; Returns: undefined }
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
        Args: never
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
      conversation_type:
        | "transaction"
        | "quote"
        | "admin_seller_dispute"
        | "admin_buyer_dispute"
        | "dispute"
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
      conversation_type: [
        "transaction",
        "quote",
        "admin_seller_dispute",
        "admin_buyer_dispute",
        "dispute",
      ],
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
