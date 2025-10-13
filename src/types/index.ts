/**
 * TypeScript type definitions for RivvLock application
 * Provides type safety across the entire codebase
 */

// ============= Enums & Literals =============

export type TransactionStatus = 'pending' | 'paid' | 'validated' | 'disputed' | 'expired';
export type DisputeStatus = 'open' | 'negotiating' | 'responded' | 'escalated' | 'resolved' | 'resolved_refund' | 'resolved_release';
export type RefundStatus = 'none' | 'partial' | 'full';
export type UserType = 'individual' | 'company';
export type CountryCode = 'FR' | 'CH' | 'DE' | 'BE' | 'LU';
export type Currency = 'eur' | 'chf';
export type UserRole = 'seller' | 'buyer';
export type DisputeType = 'quality_issue' | 'not_as_described' | 'damaged_item' | 'not_received' | 'other';
export type ProposalType = 'full_refund' | 'partial_refund' | 'no_refund';
export type DateChangeStatus = 'pending_approval' | 'approved' | 'rejected';

// ============= Database Models =============

/**
 * User profile from the profiles table
 */
export interface Profile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  user_type: UserType;
  country: CountryCode;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  company_address: string | null;
  phone: string | null;
  siret_uid: string | null;
  avs_number: string | null;
  vat_number: string | null;
  vat_rate: number | null;
  tva_rate: number | null;
  is_subject_to_vat: boolean;
  verified: boolean;
  stripe_customer_id: string | null;
  acceptance_terms: boolean;
  registration_complete: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Transaction model representing a secured payment
 */
export interface Transaction {
  id: string;
  user_id: string;
  buyer_id: string | null;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  status: TransactionStatus;
  refund_status: RefundStatus | null;
  refund_percentage: number | null;
  service_date: string | null;
  service_end_date: string | null;
  payment_deadline: string | null;
  validation_deadline: string | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  shared_link_token: string | null;
  shared_link_expires_at: string | null;
  funds_released_at: string | null;
  seller_validated_at: string | null;
  buyer_validated_at: string | null;
  date_change_status: DateChangeStatus | null;
  requested_service_date: string | null;
  date_change_message: string | null;
  renewal_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  seller_display_name?: string;
  buyer_display_name?: string;
}

/**
 * Dispute model for transaction conflicts
 */
export interface Dispute {
  id: string;
  transaction_id: string;
  reporter_id: string;
  dispute_type: DisputeType;
  reason: string;
  status: DisputeStatus;
  resolution: string | null;
  dispute_deadline: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  archived_by_seller: boolean;
  archived_by_buyer: boolean;
  seller_archived_at: string | null;
  buyer_archived_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  transactions?: Transaction;
}

/**
 * Transaction message model
 */
export interface TransactionMessage {
  id: string;
  transaction_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  // Joined fields
  sender_name?: string;
}

/**
 * Dispute message model
 */
export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  message_type: 'buyer_to_seller' | 'seller_to_buyer' | 'buyer_to_admin' | 'seller_to_admin' | 'admin_to_buyer' | 'admin_to_seller' | 'system';
  created_at: string;
  // Joined fields
  sender_name?: string;
}

/**
 * Dispute proposal model
 */
export interface DisputeProposal {
  id: string;
  dispute_id: string;
  proposed_by: string;
  proposal_type: ProposalType;
  refund_percentage: number | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  requires_both_parties: boolean;
  seller_accepted: boolean;
  buyer_accepted: boolean;
  admin_created: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  proposer_name?: string;
}

/**
 * Stripe account model
 */
export interface StripeAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  account_status: 'active' | 'pending' | 'inactive';
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_completed: boolean;
  details_submitted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Invoice model
 */
export interface Invoice {
  id: string;
  transaction_id: string;
  seller_id: string;
  buyer_id: string;
  invoice_number: string;
  amount: number;
  currency: Currency;
  vat_amount: number | null;
  vat_rate: number | null;
  issue_date: string;
  pdf_url: string | null;
  created_at: string;
}

/**
 * Activity log model
 */
export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

// ============= Component Props Types =============

/**
 * Common props for transaction-related components
 */
export interface TransactionComponentProps {
  transaction: Transaction;
  user: any; // Auth user type
  onRefetch?: () => void;
}

/**
 * Common props for dispute-related components
 */
export interface DisputeComponentProps {
  dispute: Dispute;
  onRefetch?: () => void;
}

// ============= Utility Types =============

/**
 * Validation phase for transaction lifecycle
 */
export interface ValidationStatus {
  phase: 'awaiting_payment' | 'service_pending' | 'validation_active' | 'validation_expired' | 'validated' | 'expired';
  canFinalize: boolean;
  canManuallyFinalize: boolean;
  displayLabel: string;
}

/**
 * Safe profile data for counterparties
 */
export interface SafeProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  verified: boolean;
  user_type: UserType;
  country: CountryCode;
  company_name: string | null;
}

/**
 * Invoice data for PDF generation
 */
export interface InvoiceData {
  transaction: Transaction;
  sellerProfile: Profile;
  buyerProfile: Profile;
  invoiceNumber: string;
  sellerEmail: string;
  buyerEmail: string;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  sortBy: 'created_at' | 'service_date' | 'funds_released_at';
  sortOrder: 'asc' | 'desc';
}

/**
 * New items notification counts
 */
export interface NewItemsCounts {
  pending: number;
  blocked: number;
  disputed: number;
  completed: number;
}
