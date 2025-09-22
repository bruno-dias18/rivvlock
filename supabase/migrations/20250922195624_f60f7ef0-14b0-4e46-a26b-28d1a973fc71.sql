-- PHASE 1: Complete database cleanup
-- Remove unused tables and associated functions/triggers

-- Drop unused tables that serve no purpose in the current application
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.disputes CASCADE; 
DROP TABLE IF EXISTS public.validation_reminders CASCADE;
DROP TABLE IF EXISTS public.profile_audit_log CASCADE;

-- Simplify profiles table by removing unused columns
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS siret_uid,
DROP COLUMN IF EXISTS avs_number,
DROP COLUMN IF EXISTS company_address,
DROP COLUMN IF EXISTS tva_rate,
DROP COLUMN IF EXISTS vat_rate,
DROP COLUMN IF EXISTS stripe_customer_id,
DROP COLUMN IF EXISTS acceptance_terms,
DROP COLUMN IF EXISTS registration_complete;

-- Remove unused functions and triggers
DROP FUNCTION IF EXISTS public.audit_profile_changes() CASCADE;
DROP FUNCTION IF EXISTS public.log_security_event(text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.validate_no_sensitive_data() CASCADE;

-- Simplify transactions table by removing unused columns  
ALTER TABLE public.transactions
DROP COLUMN IF EXISTS seller_validated,
DROP COLUMN IF EXISTS buyer_validated,
DROP COLUMN IF EXISTS validation_deadline,
DROP COLUMN IF EXISTS funds_released,
DROP COLUMN IF EXISTS dispute_id,
DROP COLUMN IF EXISTS shared_link_expires_at,
DROP COLUMN IF EXISTS payment_window_hours,
DROP COLUMN IF EXISTS payment_blocked_at,
DROP COLUMN IF EXISTS link_expires_at;

-- Remove unused Stripe accounts table
DROP TABLE IF EXISTS public.stripe_accounts CASCADE;

-- Simplify admin roles table - keep only essential fields
ALTER TABLE public.admin_roles 
DROP COLUMN IF EXISTS email;