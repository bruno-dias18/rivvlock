-- Phase 5 - Step 2A: Extend conversation_type enum
-- Add dispute-related conversation types to the enum

-- Add 'dispute' type (two-party dispute conversation)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'dispute' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'conversation_type')
  ) THEN
    ALTER TYPE conversation_type ADD VALUE 'dispute';
  END IF;
END $$;