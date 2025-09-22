-- Add missing fields to profiles table that are referenced in the handle_new_user function
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS siret_uid TEXT,
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS avs_number TEXT,
ADD COLUMN IF NOT EXISTS tva_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS acceptance_terms BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS registration_complete BOOLEAN DEFAULT false;

-- Add independent as a user type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
        CREATE TYPE public.user_type AS ENUM ('individual', 'company', 'independent');
    ELSE
        -- Check if independent value exists, if not add it
        BEGIN
            ALTER TYPE public.user_type ADD VALUE IF NOT EXISTS 'independent';
        EXCEPTION WHEN duplicate_object THEN
            -- Value already exists, do nothing
            NULL;
        END;
    END IF;
END $$;