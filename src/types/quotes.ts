import { Currency } from './index';

export type QuoteStatus = 
  | 'pending' 
  | 'negotiating' 
  | 'accepted' 
  | 'refused' 
  | 'expired' 
  | 'archived';

export interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: string;
  seller_id: string;
  client_user_id: string | null;
  client_email: string;
  client_name: string | null;
  title: string;
  description: string | null;
  items: QuoteItem[];
  subtotal: number;
  tax_rate: number | null;
  tax_amount: number | null;
  total_amount: number;
  currency: Currency;
  service_date: string | null;
  service_end_date: string | null;
  valid_until: string;
  status: QuoteStatus;
  secure_token: string;
  token_expires_at: string;
  converted_transaction_id: string | null;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteMessage {
  id: string;
  quote_id: string;
  sender_id: string | null;
  sender_email: string;
  sender_name: string;
  message: string;
  message_type: 'text' | 'proposal_update';
  metadata: Record<string, any>;
  created_at: string;
}

export interface QuoteRevision {
  id: string;
  quote_id: string;
  revision_number: number;
  items: QuoteItem[];
  total_amount: number;
  changed_by: string;
  change_reason: string | null;
  created_at: string;
}
