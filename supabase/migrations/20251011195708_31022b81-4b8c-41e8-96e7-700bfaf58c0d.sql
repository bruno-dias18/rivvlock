-- Add missing activity types for disputes and transactions
-- Security audit: This migration only adds allowed values to a CHECK constraint
-- No impact on RLS policies, Stripe integration, or data security

BEGIN;

-- Drop the existing constraint
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_activity_type_check;

-- Recreate with all current and missing activity types
ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_activity_type_check
  CHECK (
    activity_type IN (
      -- Transaction activities (existing)
      'transaction_created',
      'funds_blocked',
      'transaction_validated',
      'transaction_joined',
      'buyer_joined_transaction',
      'seller_validation',
      'buyer_validation',
      'profile_updated',
      'funds_released',
      'transaction_completed',
      'transaction_deleted',
      'payment_sync',
      
      -- Dispute activities (existing + new)
      'dispute_created',
      'dispute_message_received',
      'dispute_proposal_created',
      'dispute_proposal_accepted',
      'dispute_proposal_rejected',
      'dispute_admin_message',
      'dispute_status_changed',
      'dispute_escalated'
    )
  );

COMMIT;