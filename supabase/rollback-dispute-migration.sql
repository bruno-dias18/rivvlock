-- Rollback Script for Phase 5 - Step 2: Data Migration
-- Use this script to revert the dispute data migration if needed

-- IMPORTANT: Only use this if you need to rollback the data migration
-- This will NOT delete any disputes or transactions, only unlink conversations

-- Step 1: Remove admin conversations created for disputes
DELETE FROM public.conversations
WHERE conversation_type IN ('admin_seller_dispute', 'admin_buyer_dispute')
  AND dispute_id IS NOT NULL;

-- Step 2: Unlink disputes from conversations
UPDATE public.disputes
SET conversation_id = NULL,
    updated_at = now()
WHERE conversation_id IS NOT NULL;

-- Step 3: Remove dispute conversations (two-party)
DELETE FROM public.conversations
WHERE conversation_type = 'dispute'
  AND dispute_id IS NOT NULL;

-- Step 4: Verify rollback
-- Run these queries to verify the rollback was successful:

-- Should return 0
-- SELECT COUNT(*) FROM disputes WHERE conversation_id IS NOT NULL;

-- Should return 0
-- SELECT COUNT(*) FROM conversations WHERE dispute_id IS NOT NULL;

-- Step 5: Drop the validation view if no longer needed
-- DROP VIEW IF EXISTS public.dispute_migration_status;

-- Note: Feature flags (UNIFIED_DISPUTES = false) should be set BEFORE running this rollback
-- to ensure the application uses the legacy dispute system
