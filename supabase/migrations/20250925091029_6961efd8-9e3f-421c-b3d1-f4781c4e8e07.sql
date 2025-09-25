-- Fix activity_logs activity_type allowed values so dashboard shows the requested events
BEGIN;

-- Drop the old CHECK constraint if it exists
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_activity_type_check;

-- Recreate the CHECK constraint with the complete, current set of activity types used in the app
ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_activity_type_check
  CHECK (
    activity_type IN (
      'transaction_created',
      'funds_blocked',
      'transaction_validated',
      'transaction_joined',
      'buyer_joined_transaction',
      'seller_validation',
      'buyer_validation',
      'profile_updated',
      'dispute_created',
      'funds_released',
      'transaction_completed',
      'payment_sync'
    )
  );

COMMIT;